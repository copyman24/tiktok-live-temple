use std::error::Error;
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use serde::Deserialize;
use tauri::{App, AppHandle, Manager, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use uuid::Uuid;

const HOST: &str = "127.0.0.1";
const PORT: u16 = 3108;
const BACKEND_START_TIMEOUT: Duration = Duration::from_secs(30);

struct AppPaths {
    resources: PathBuf,
    data: PathBuf,
}

struct BackendRuntime {
    child: Mutex<Option<CommandChild>>,
    shutdown_token: String,
    shutting_down: AtomicBool,
    exited: AtomicBool,
}

#[derive(Deserialize)]
struct HealthResponse {
    ok: bool,
    app: String,
    pid: u32,
}

enum HealthProbe {
    Unavailable,
    Ready,
    Occupied(String),
}

impl AppPaths {
    fn resolve(app: &App) -> Result<Self, Box<dyn Error>> {
        let resources = if cfg!(debug_assertions) {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..").canonicalize()?
        } else {
            app.path().resource_dir()?
        };
        let data = app.path().app_local_data_dir()?;
        fs::create_dir_all(data.join("logs"))?;
        Ok(Self { resources, data })
    }
}

pub fn setup(app: &mut App) -> Result<(), Box<dyn Error>> {
    let paths = AppPaths::resolve(app)?;
    let shutdown_token = Uuid::new_v4().to_string();
    let command = app
        .shell()
        .sidecar("wedding-backend")?
        .set_process_group(true)
        .env("WEDDING_RESOURCE_DIR", paths.resources.to_string_lossy().as_ref())
        .env("WEDDING_DATA_DIR", paths.data.to_string_lossy().as_ref())
        .env("WEDDING_HOST", HOST)
        .env("WEDDING_PORT", PORT.to_string())
        .env("WEDDING_SHUTDOWN_TOKEN", &shutdown_token);

    let (mut events, child) = match command.spawn() {
        Ok(process) => process,
        Err(error) => {
            let message = format!("Could not start the wedding backend sidecar. {error}");
            show_startup_error(app, &message);
            return Err(message.into());
        }
    };
    let pid = child.pid();
    app.manage(BackendRuntime {
        child: Mutex::new(Some(child)),
        shutdown_token,
        shutting_down: AtomicBool::new(false),
        exited: AtomicBool::new(false),
    });

    let handle = app.handle().clone();
    let backend_log = paths.data.join("logs").join("backend.log");
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(line) => append_log(&backend_log, "stdout", &line),
                CommandEvent::Stderr(line) => append_log(&backend_log, "stderr", &line),
                CommandEvent::Error(error) => append_log(&backend_log, "error", error.as_bytes()),
                CommandEvent::Terminated(payload) => {
                    append_log(&backend_log, "exit", format!("code {:?}", payload.code).as_bytes());
                    if let Some(runtime) = handle.try_state::<BackendRuntime>() {
                        runtime.exited.store(true, Ordering::SeqCst);
                    }
                    break;
                }
                _ => {}
            }
        }
    });

    if let Err(error) = wait_for_backend(&app.handle(), pid) {
        stop_backend(app);
        show_startup_error(app, &error);
        return Err(error.into());
    }

    let Some(window) = app.config().app.windows.first() else {
        let error = "No wedding window is configured.".to_string();
        stop_backend(app);
        show_startup_error(app, &error);
        return Err(error.into());
    };
    if let Err(error) = WebviewWindowBuilder::from_config(app.handle(), window)?.build() {
        stop_backend(app);
        return Err(error.to_string().into());
    }
    Ok(())
}

pub fn begin_shutdown(app: &AppHandle) -> bool {
    let Some(runtime) = app.try_state::<BackendRuntime>() else { return false };
    !runtime.shutting_down.swap(true, Ordering::SeqCst)
}

pub fn finish_shutdown(app: &AppHandle) {
    let token = app.try_state::<BackendRuntime>().map(|runtime| runtime.shutdown_token.clone());
    if let Some(token) = token {
        let _ = request_shutdown(&token);
        thread::sleep(Duration::from_millis(250));
    }
    if let Some(runtime) = app.try_state::<BackendRuntime>() {
        if let Ok(mut child) = runtime.child.lock() {
            if let Some(child) = child.take() {
                let _ = child.kill();
            }
        }
    }
}

fn stop_backend(app: &App) {
    if let Some(runtime) = app.try_state::<BackendRuntime>() {
        if let Ok(mut child) = runtime.child.lock() {
            if let Some(child) = child.take() {
                let _ = child.kill();
            }
        }
    }
}

fn wait_for_backend(app: &AppHandle, expected_pid: u32) -> Result<(), String> {
    let deadline = Instant::now() + BACKEND_START_TIMEOUT;
    let address = format!("{HOST}:{PORT}").parse::<SocketAddr>().map_err(|error| error.to_string())?;
    loop {
        match probe_health(address, expected_pid)? {
            HealthProbe::Ready => return Ok(()),
            HealthProbe::Occupied(message) => return Err(message),
            HealthProbe::Unavailable => {}
        }
        if let Some(runtime) = app.try_state::<BackendRuntime>() {
            if runtime.exited.load(Ordering::SeqCst) {
                return Err("The wedding backend exited during startup. Check its log in the app data directory.".into());
            }
        }
        if Instant::now() >= deadline {
            return Err(format!("The wedding backend did not answer on {HOST}:{PORT} within 30 seconds."));
        }
        thread::sleep(Duration::from_millis(100));
    }
}

fn probe_health(address: SocketAddr, expected_pid: u32) -> Result<HealthProbe, String> {
    let mut stream = match TcpStream::connect_timeout(&address, Duration::from_millis(300)) {
        Ok(stream) => stream,
        Err(_) => return Ok(HealthProbe::Unavailable),
    };
    stream.set_read_timeout(Some(Duration::from_secs(1))).map_err(|error| error.to_string())?;
    stream.set_write_timeout(Some(Duration::from_secs(1))).map_err(|error| error.to_string())?;
    write!(stream, "GET /health HTTP/1.1\r\nHost: {HOST}:{PORT}\r\nConnection: close\r\n\r\n")
        .map_err(|error| error.to_string())?;
    let mut response = String::new();
    stream.read_to_string(&mut response).map_err(|error| error.to_string())?;
    let Some((_, body)) = response.split_once("\r\n\r\n") else { return Ok(HealthProbe::Unavailable) };
    let Ok(health) = serde_json::from_str::<HealthResponse>(body) else { return Ok(HealthProbe::Unavailable) };
    if health.ok && health.app == "virtual-wedding" && health.pid == expected_pid {
        return Ok(HealthProbe::Ready);
    }
    if health.ok {
        return Ok(HealthProbe::Occupied(format!(
            "Port {PORT} is already serving {} (PID {}). Close that process and try again.",
            health.app, health.pid
        )));
    }
    Ok(HealthProbe::Unavailable)
}

fn request_shutdown(token: &str) -> Result<(), String> {
    let address = format!("{HOST}:{PORT}").parse::<SocketAddr>().map_err(|error| error.to_string())?;
    let mut stream = TcpStream::connect_timeout(&address, Duration::from_secs(2)).map_err(|error| error.to_string())?;
    stream.set_read_timeout(Some(Duration::from_secs(2))).map_err(|error| error.to_string())?;
    write!(
        stream,
        "POST /api/shutdown HTTP/1.1\r\nHost: {HOST}:{PORT}\r\nConnection: close\r\nContent-Length: 0\r\nX-Wedding-Shutdown-Token: {token}\r\n\r\n"
    ).map_err(|error| error.to_string())?;
    let mut response = String::new();
    stream.read_to_string(&mut response).map_err(|error| error.to_string())?;
    if response.starts_with("HTTP/1.1 200") { Ok(()) } else { Err("Backend rejected shutdown.".into()) }
}

fn append_log(path: &PathBuf, stream: &str, bytes: &[u8]) {
    let line = String::from_utf8_lossy(bytes);
    let line = line.trim_end();
    if line.is_empty() { return; }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "[{stream}] {line}");
    }
}

fn show_startup_error(app: &App, message: &str) {
    app.dialog()
        .message(message)
        .title("Virtual Wedding Live failed to start")
        .blocking_show();
}
