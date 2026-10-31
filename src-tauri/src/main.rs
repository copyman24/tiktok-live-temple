#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod runtime;

use tauri::RunEvent;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(runtime::setup)
        .build(tauri::generate_context!())
        .expect("failed to start TikTok Live Temple")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { api, .. } = event {
                if runtime::should_delay_exit(app_handle) {
                    api.prevent_exit();
                    if runtime::begin_shutdown(app_handle) {
                        let app_handle = app_handle.clone();
                        std::thread::spawn(move || {
                            runtime::finish_shutdown(&app_handle);
                            app_handle.exit(0);
                        });
                    }
                }
            }
        });
}
