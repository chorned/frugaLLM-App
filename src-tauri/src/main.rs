// Notice: Portions of this file are derivative works based on the LiteLLM project, originally licensed under the MIT License.
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod commands;
pub mod db;
pub mod model_db;
pub mod proxy;
pub mod state;
pub mod telemetry;
#[cfg(test)]
mod test_restart;
#[cfg(test)]
mod tests;
pub mod tray;

pub use commands::*;
pub use proxy::*;
pub use state::*;
pub use telemetry::{HardwareProfile, MemorySegments, TelemetryPayload};

use std::env;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tauri_plugin_store::StoreExt;

pub fn should_show_window(is_silent: bool, start_minimized: bool) -> bool {
    !(is_silent && start_minimized)
}

fn main() {
    #[cfg(debug_assertions)]
    dotenvy::dotenv().ok();
    let args: Vec<String> = env::args().collect();

    if args.contains(&"--wipe".to_string()) {
        println!("Wiping credentials, store, and opencode...");
        let _ = wipe_credentials();
        if let Ok(h) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
            wipe_opencode(std::path::Path::new(&h));
        }
    }

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--silent"]),
        ))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(PtyState::default())
        .manage(OllamaDaemonState {
            child: tokio::sync::Mutex::new(None),
        })
        .manage(Arc::new(ChildProcessManager::new()))
        .manage(Arc::new(std::sync::atomic::AtomicBool::new(false)))
        .setup(|app| {
            let app_handle = app.handle().clone();
            let mut frugal_config = FrugalConfig::default();
            if env::args().any(|arg| arg == "--wipe") {
                if let Ok(home) = app_handle.path().home_dir() {
                    wipe_opencode(&home);
                }
                if let Ok(app_dir) = app_handle.path().app_data_dir() {
                    let _ = std::fs::remove_file(app_dir.join("tool_gateway_installed"));
                    let _ = std::fs::remove_dir_all(app_dir.join("models"));
                    let _ = std::fs::remove_file(app_dir.join("frugal_config.json"));
                }
            } else if let Ok(path) = get_config_path(&app_handle) {
                if let Ok(json) = std::fs::read_to_string(path) {
                    if let Ok(mut parsed) = serde_json::from_str::<FrugalConfig>(&json) {
                        parsed.input_tokens_session = 0;
                        parsed.output_tokens_session = 0;
                        parsed.cached_tokens_session = 0;
                        frugal_config = parsed;
                    }
                }
            }
            let is_silent = env::args().any(|arg| arg == "--silent" || arg == "--minimized");
            let start_minimized = app
                .store("store.json")
                .ok()
                .and_then(|s| s.get("start_minimized").and_then(|v| v.as_bool()))
                .unwrap_or(frugal_config.start_minimized);
            let config_arc = Arc::new(tokio::sync::Mutex::new(frugal_config));
            let server_abort_handle = Arc::new(tokio::sync::Mutex::new(None));
            let is_dirty = Arc::new(std::sync::atomic::AtomicBool::new(false));
            let server_status = Arc::new(tokio::sync::RwLock::new(ServerStatus::Starting));
            app.manage(FrugalConfigState {
                config: config_arc.clone(),
                server_abort_handle: server_abort_handle.clone(),
                is_dirty: is_dirty.clone(),
                server_status: server_status.clone(),
            });

            // Background task: persist config to disk if dirty every 3 seconds (decoupled from proxy stream path)
            let app_handle_flush = app_handle.clone();
            let config_arc_flush = config_arc.clone();
            let is_dirty_flush = is_dirty.clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(std::time::Duration::from_secs(3));
                loop {
                    interval.tick().await;
                    if is_dirty_flush.swap(false, std::sync::atomic::Ordering::AcqRel) {
                        let config_clone = {
                            let config = config_arc_flush.lock().await;
                            config.clone()
                        };
                        if let Ok(path) = get_config_path(&app_handle_flush) {
                            if let Ok(json) = serde_json::to_string_pretty(&config_clone) {
                                let _ = std::fs::write(path, json);
                            }
                        }
                    }
                }
            });

            // Dynamic Roster Managed State
            let dynamic_roster = Arc::new(tokio::sync::RwLock::new(Vec::new()));
            app.manage(DynamicRosterState {
                fallback_chain: dynamic_roster.clone(),
            });

            // Provider Health State (in-memory circuit breaker and rate limit cooldowns)
            let health_state = ProviderHealthState::default();
            app.manage(health_state);

            // Start proxy server, health loop, and background Ollama daemon
            let server_handle = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                proxy::server::start_frugallm_server(server_handle).await;
            });
            proxy::server::start_provider_health_loop(app_handle.clone());
            let ollama_handle = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                let _ = commands::agents::start_ollama_daemon(&ollama_handle).await;
            });

            // Handle Silent / Start Minimized Window Visibility
            if !should_show_window(is_silent, start_minimized) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            tray::setup_system_tray(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_model_override,
            get_launch_options,
            set_credential,
            get_credential,
            delete_credential,
            wipe_credentials,
            check_hermes_status,
            check_opencode_status,
            check_ollama_status,
            get_ollama_chat_model,
            get_hermes_version,
            get_opencode_version,
            uninstall_ollama,
            uninstall_opencode,
            uninstall_hermes,
            detect_vram,
            detect_hardware_profile,
            spawn_pty,
            write_pty,
            kill_pty,
            resize_pty,
            configure_hermes_defaults,
            configure_opencode_defaults,
            deploy_local_model,
            get_frugallm_config,
            set_frugallm_config,
            get_provider_statuses,
            get_frugallm_server_status,
            edit_hermes_soul,
            open_app_logs,
            is_wipe_mode,
            is_mock_update_mode,
            get_local_ips,
            restart_app,
            get_routing_chain,
            set_routing_chain,
            refresh_routing_chain,
            check_tool_gateway_status,
            set_tool_gateway_installed,
            get_model_tag_for_vram,
            start_hermes_service,
            stop_hermes_service,
            has_active_services,
            get_active_services,
            confirm_exit_app,
            check_hermes_ready,
            set_global_cli_commands,
            get_global_cli_commands_status,
            get_diagnostic_data,
            submit_issue_report
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| match event {
        tauri::RunEvent::ExitRequested { api, .. } => {
            handle_preventable_exit(app_handle, || api.prevent_exit());
        }
        tauri::RunEvent::WindowEvent {
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } => {
            handle_preventable_exit(app_handle, || api.prevent_close());
        }
        _ => {}
    });
}

pub fn flush_config_on_exit(app_handle: &tauri::AppHandle) {
    let state = app_handle.state::<FrugalConfigState>();
    if state
        .is_dirty
        .swap(false, std::sync::atomic::Ordering::AcqRel)
    {
        let config_clone = if let Ok(guard) = state.config.try_lock() {
            guard.clone()
        } else {
            tauri::async_runtime::block_on(async {
                let guard = state.config.lock().await;
                guard.clone()
            })
        };
        if let Ok(path) = get_config_path(app_handle) {
            if let Ok(json) = serde_json::to_string_pretty(&config_clone) {
                let _ = std::fs::write(path, json);
            }
        }
    }
}

fn handle_preventable_exit(app_handle: &tauri::AppHandle, prevent: impl FnOnce()) {
    let process_manager = app_handle.state::<Arc<ChildProcessManager>>();
    let allow_exit = app_handle.state::<Arc<std::sync::atomic::AtomicBool>>();
    let is_allowed = allow_exit.load(std::sync::atomic::Ordering::Acquire);
    let has_active = process_manager.has_active_services();

    if !is_allowed && has_active {
        prevent();
        let _ = app_handle.emit("request_exit_confirmation", ());
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = window.unminimize();
        }
    } else {
        process_manager.kill_all();
        flush_config_on_exit(app_handle);
    }
}
