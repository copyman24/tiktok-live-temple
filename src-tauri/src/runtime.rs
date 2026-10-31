use std::error::Error;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::PathBuf;
use std::sync::{Condvar, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::Deserialize;
use tauri::{App, AppHandle, Manager, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use uuid::Uuid;

const HOST: &str = "localhost";
const PORT: u16 = 3000;
const BACKEND_START_TIMEOUT: Duration = Duration::from_secs(30);
const BACKEND_STOP_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug)]
enum BackendState {
    Starting,
    Ready { pid: u32 },
    Failed(String),
    Stopping,
    Exited(Option<i32>),
}

struct AppPaths {
    resources: PathBuf,
    data: PathBuf,
}

struct BackendProcess {
    state: BackendState,
    child: Option<CommandChild>,
    shutdown_token: String,
}

struct BackendRuntime {
    process: Mutex<BackendProcess>,
    changed: Condvar,
}

#[derive(Deserialize)]
struct HealthResponse {
    ok: bool,
    pid: u32,
}

enum HealthProbe {
    Unavailable,
    Responded(u32),
}

impl AppPaths {
    fn resolve(app: &App) -> Result<Self, Box<dyn Error>> {
        let resources = if cfg!(debug_assertions) {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .canonicalize()?
        } else {
            app.path().resource_dir()?
        };
        let data = app.path().app_local_data_dir()?;
        fs::create_dir_all(data.join("tts-cache"))?;
        fs::create_dir_all(data.join("models"))?;
        fs::create_dir_all(data.join("logs"))?;
        Ok(Self { resources, data })
    }
}

fn log_path(paths: &AppPaths) -> PathBuf {
    paths.data.join("logs").join("backend.log")
}

fn append_log(path: &PathBuf, stream: &str, bytes: &[u8]) {
    let line = String::from_utf8_lossy(bytes);
    let line = line.trim_end();
    if line.is_empty() {
        return;
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "[{stream}] {line}");
    }
}

fn show_startup_error(app: &App, message: &str) {
    app.dialog()
        .message(message)
        .title("TikTok Live Temple failed to start")
        .blocking_show();
}

pub fn setup(app: &mut App) -> Result<(), Box<dyn Error>> {
    let paths = AppPaths::resolve(app)?;
    let shutdown_token = Uuid::new_v4().to_string();
    let command = app
        .shell()
        .sidecar("temple-backend")?
        .set_process_group(true)
        .env("APP_RESOURCE_DIR", &paths.resources)
        .env("APP_DATA_DIR", &paths.data)
        .env("HOST", HOST)
        .env("PORT", PORT.to_string())
        .env("TEMPLE_SHUTDOWN_TOKEN", &shutdown_token);
    let command = if cfg!(debug_assertions) {
        command
    } else {
        command.env("ZERO_TTS_BIN", paths.resources.join("zerotts-worker.exe"))
    };

    let (mut events, child) = match command.spawn() {
        Ok(process) => process,
        Err(error) => {
            let message = format!("Could not start the backend sidecar. {error}");
            show_startup_error(app, &message);
            return Err(message.into());
        }
    };
    let pid = child.pid();
    let runtime = BackendRuntime {
        process: Mutex::new(BackendProcess {
            state: BackendState::Starting,
            child: Some(child),
            shutdown_token,
        }),
        changed: Condvar::new(),
    };
    app.manage(runtime);

    let handle = app.handle().clone();
    let backend_log = log_path(&paths);
    tauri::async_runtime::spawn(async move {
        let mut exit_code = None;
        while let Some(event) = events.recv().await {
            match event {
                CommandEvent::Stdout(line) => append_log(&backend_log, "stdout", &line),
                CommandEvent::Stderr(line) => append_log(&backend_log, "stderr", &line),
                CommandEvent::Error(error) => {
                    append_log(&backend_log, "error", error.as_bytes());
                }
                CommandEvent::Terminated(payload) => {
                    exit_code = payload.code;
                    break;
                }
                _ => {}
            }
        }
        set_exited(&handle, exit_code);
    });

    match wait_for_backend(&app.handle(), pid) {
        Ok(()) => {
            let runtime = app.state::<BackendRuntime>();
            let mut process = runtime.process.lock().map_err(|error| error.to_string())?;
            process.state = BackendState::Ready { pid };
            runtime.changed.notify_all();
        }
        Err(error) => {
            fail_and_kill(app, &error);
            show_startup_error(app, &error);
            return Err(error.into());
        }
    }

    let Some(window) = app.config().app.windows.first() else {
        let error = "No desktop window is configured.".to_string();
        fail_and_kill(app, &error);
        show_startup_error(app, &error);
        return Err(error.into());
    };
    if let Err(error) = WebviewWindowBuilder::from_config(app.handle(), window)?.build() {
        fail_and_kill(app, &error.to_string());
        return Err(error.into());
    }
    Ok(())
}

fn fail_and_kill(app: &App, message: &str) {
    let runtime = app.state::<BackendRuntime>();
    if let Ok(mut process) = runtime.process.lock() {
        process.state = BackendState::Failed(message.to_string());
        if let Some(child) = process.child.take() {
            let _ = child.kill();
        }
        runtime.changed.notify_all();
    }
}

fn set_exited(app: &AppHandle, code: Option<i32>) {
    let runtime = app.state::<BackendRuntime>();
    if let Ok(mut process) = runtime.process.lock() {
        process.state = BackendState::Exited(code);
        process.child.take();
        runtime.changed.notify_all();
    }
}

fn wait_for_backend(app: &AppHandle, expected_pid: u32) -> Result<(), String> {
    let deadline = Instant::now() + BACKEND_START_TIMEOUT;
    loop {
        match probe_health()? {
            HealthProbe::Responded(pid) if pid == expected_pid => return Ok(()),
            HealthProbe::Responded(pid) => {
                return Err(format!(
                    "Port {PORT} is already serving another process (PID {pid}). Close that process and try again."
                ));
            }
            HealthProbe::Unavailable => {}
        }

        let runtime = app.state::<BackendRuntime>();
        if let Ok(process) = runtime.process.lock() {
            match &process.state {
                BackendState::Exited(code) => {
                    return Err(format!(
                        "The backend exited during startup with code {code:?}."
                    ));
                }
                BackendState::Failed(message) => return Err(message.clone()),
                _ => {}
            }
        }

        if Instant::now() >= deadline {
            return Err(format!(
                "The backend did not become ready on http://{HOST}:{PORT} within {} seconds.",
                BACKEND_START_TIMEOUT.as_secs()
            ));
        }
        thread::sleep(Duration::from_millis(200));
    }
}

fn probe_health() -> Result<HealthProbe, String> {
    let addresses = (HOST, PORT)
        .to_socket_addrs()
        .map_err(|error| format!("Could not resolve {HOST}: {error}"))?;

    for address in addresses {
        let mut stream = match TcpStream::connect_timeout(&address, Duration::from_millis(300)) {
            Ok(stream) => stream,
            Err(_) => continue,
        };
        stream
            .set_read_timeout(Some(Duration::from_secs(1)))
            .map_err(|error| error.to_string())?;
        stream
            .write_all(
                format!(
                    "GET /api/health HTTP/1.1\r\nHost: {HOST}:{PORT}\r\nConnection: close\r\n\r\n"
                )
                .as_bytes(),
            )
            .map_err(|error| error.to_string())?;

        let mut response = Vec::new();
        stream
            .take(64 * 1024)
            .read_to_end(&mut response)
            .map_err(|error| error.to_string())?;
        let response = String::from_utf8_lossy(&response);
        let (headers, body) = response
            .split_once("\r\n\r\n")
            .ok_or_else(|| format!("Port {PORT} returned an invalid health response."))?;
        if !headers
            .lines()
            .next()
            .is_some_and(|line| line.contains(" 200 "))
        {
            return Err(format!(
                "Port {PORT} is in use by a different local service."
            ));
        }
        let health: HealthResponse = serde_json::from_str(body)
            .map_err(|_| format!("Port {PORT} returned an invalid health response."))?;
        if !health.ok {
            return Err(format!(
                "Port {PORT} reported that the backend is not ready."
            ));
        }
        return Ok(HealthProbe::Responded(health.pid));
    }

    Ok(HealthProbe::Unavailable)
}

pub fn should_delay_exit(app: &AppHandle) -> bool {
    let runtime = app.state::<BackendRuntime>();
    let Ok(process) = runtime.process.lock() else {
        return false;
    };
    matches!(
        &process.state,
        BackendState::Starting | BackendState::Ready { .. } | BackendState::Stopping
    )
}

pub fn begin_shutdown(app: &AppHandle) -> bool {
    let runtime = app.state::<BackendRuntime>();
    let Ok(mut process) = runtime.process.lock() else {
        return false;
    };
    if !matches!(
        &process.state,
        BackendState::Ready { .. } | BackendState::Starting
    ) {
        return false;
    }
    process.state = BackendState::Stopping;
    runtime.changed.notify_all();
    true
}

pub fn finish_shutdown(app: &AppHandle) {
    let runtime = app.state::<BackendRuntime>();
    let token = match runtime.process.lock() {
        Ok(process) => process.shutdown_token.clone(),
        Err(error) => {
            eprintln!("Could not read backend state: {error}");
            return;
        }
    };

    if let Err(error) = request_shutdown(&token) {
        eprintln!("Could not request backend shutdown: {error}");
    }

    let process = match runtime.process.lock() {
        Ok(process) => process,
        Err(error) => {
            eprintln!("Could not lock backend state: {error}");
            return;
        }
    };
    let (mut process, timeout) =
        match runtime
            .changed
            .wait_timeout_while(process, BACKEND_STOP_TIMEOUT, |process| {
                !matches!(&process.state, BackendState::Exited(_))
            }) {
            Ok(result) => result,
            Err(error) => {
                eprintln!("Could not wait for backend exit: {error}");
                return;
            }
        };

    if timeout.timed_out() && matches!(&process.state, BackendState::Stopping) {
        let child = process.child.take();
        drop(process);
        if let Some(child) = child {
            if let Err(error) = child.kill() {
                eprintln!("Could not kill backend sidecar: {error}");
            }
        }
        let process_guard = match runtime.process.lock() {
            Ok(process) => process,
            Err(error) => {
                eprintln!("Could not lock backend state after kill: {error}");
                return;
            }
        };
        let (next, _) = match runtime.changed.wait_timeout_while(
            process_guard,
            Duration::from_secs(2),
            |process| !matches!(&process.state, BackendState::Exited(_)),
        ) {
            Ok(result) => result,
            Err(error) => {
                eprintln!("Could not confirm backend exit: {error}");
                return;
            }
        };
        process = next;
    }

    if let BackendState::Failed(message) = &process.state {
        eprintln!("Backend stopped after an error: {message}");
    }
    if let BackendState::Exited(code) = &process.state {
        append_exit_log(app, *code);
    }
}

fn append_exit_log(app: &AppHandle, code: Option<i32>) {
    if let Ok(data_dir) = app.path().app_local_data_dir() {
        append_log(
            &data_dir.join("logs").join("backend.log"),
            "tauri",
            format!("Backend exited with code {code:?}").as_bytes(),
        );
    }
}

fn request_shutdown(token: &str) -> Result<(), String> {
    let addresses = (HOST, PORT)
        .to_socket_addrs()
        .map_err(|error| format!("Could not resolve {HOST}: {error}"))?;
    let mut last_error = None;
    for address in addresses {
        let mut stream = match TcpStream::connect_timeout(&address, Duration::from_secs(1)) {
            Ok(stream) => stream,
            Err(error) => {
                last_error = Some(error.to_string());
                continue;
            }
        };
        stream
            .set_read_timeout(Some(Duration::from_secs(2)))
            .map_err(|error| error.to_string())?;
        stream
            .write_all(
                format!(
                    "POST /api/shutdown HTTP/1.1\r\nHost: {HOST}:{PORT}\r\nConnection: close\r\nContent-Length: 0\r\nX-Temple-Shutdown-Token: {token}\r\n\r\n"
                )
                .as_bytes(),
            )
            .map_err(|error| error.to_string())?;
        let mut reader = BufReader::new(stream);
        let mut status = String::new();
        reader
            .read_line(&mut status)
            .map_err(|error| error.to_string())?;
        if status.contains(" 202 ") {
            return Ok(());
        }
        return Err(format!(
            "Backend rejected shutdown request: {}",
            status.trim()
        ));
    }
    Err(last_error.unwrap_or_else(|| "No loopback address was available.".to_string()))
}
