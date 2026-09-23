// Notice: Portions of this file are derivative works based on the LiteLLM project, originally licensed under the MIT License.
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod telemetry;
pub mod model_db;
pub mod state;
pub mod db;
pub mod proxy;
pub mod commands;
pub mod tray;
pub mod lifecycle;
#[cfg(test)]
mod tests;

pub use telemetry::{HardwareProfile, MemorySegments, TelemetryPayload};
pub use state::*;
pub use proxy::*;
pub use commands::*;
pub use lifecycle::*;

use std::env;
use tauri::Manager;
use tauri_plugin_store::StoreExt;
use std::sync::Arc;

fn main() {
    #[cfg(debug_assertions)]
    dotenvy::dotenv().ok();
    let args: Vec<String> = env::args().collect();
    
    if args.iter().any(|a| a == "--in-memory-credentials" || a == "--uat-runner")
        || env::var("FRUGALLM_IN_MEMORY_CREDENTIALS").map(|v| v == "1" || v == "true").unwrap_or(false)
    {
        crate::db::use_in_memory_credential_store();
    }
    
    if args.contains(&"--wipe".to_string()) {
        println!("Wiping credentials, store, and agent configurations...");
        let _ = wipe_credentials();
        if let Some(h) = dirs::home_dir() {
            wipe_opencode(&h);
            let _ = std::fs::remove_dir_all(h.join(".hermes"));
            let _ = std::fs::remove_dir_all(h.join(".ollama"));
        }
    }

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            handle_single_instance(app, argv);
        }))
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--silent"])))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_window_state::Builder::default().with_state_flags(tauri_plugin_window_state::StateFlags::all() & !tauri_plugin_window_state::StateFlags::VISIBLE & !tauri_plugin_window_state::StateFlags::SIZE).build())
        .manage(PtyState::default())
        .manage(OllamaDaemonState { child: tokio::sync::Mutex::new(None) })
        .manage(Arc::new(ChildProcessManager::new()))
        .manage(Arc::new(std::sync::atomic::AtomicBool::new(false)))
        .setup(|app| {
            let app_handle = app.handle().clone();
            let mut frugal_config = FrugalConfig::default();
            if let Ok(path) = get_config_path(&app_handle) {
                if let Ok(json) = std::fs::read_to_string(path) {
                    if let Ok(mut parsed) = serde_json::from_str::<FrugalConfig>(&json) {
                        parsed.input_tokens_session = 0;
                        parsed.output_tokens_session = 0;
                        parsed.cached_tokens_session = 0;
                        frugal_config = parsed;
                    }
                }
            }
            let is_wipe = env::args().any(|arg| arg == "--wipe");
            let is_silent = env::args().any(|arg| arg == "--silent" || arg == "--minimized");
            let is_hidden = env::args().any(|arg| arg == "--hidden" || arg == "--uat-runner");
            let start_minimized = app.store("store.json").ok()
                .and_then(|s| s.get("start_minimized").and_then(|v| v.as_bool()))
                .unwrap_or(frugal_config.start_minimized);
            let init_host = if frugal_config.bind_all_interfaces { "0.0.0.0" } else { "127.0.0.1" };
            let init_port = frugal_config.port;
            let config_arc = Arc::new(tokio::sync::Mutex::new(frugal_config));
            let server_abort_handle = Arc::new(tokio::sync::Mutex::new(None));
            let is_dirty = Arc::new(std::sync::atomic::AtomicBool::new(false));
            let server_status = Arc::new(tokio::sync::RwLock::new(ServerStatus::Starting));
            app.manage(FrugalConfigState { config: config_arc.clone(), server_abort_handle: server_abort_handle.clone(), is_dirty: is_dirty.clone(), server_status: server_status.clone() });

            if is_wipe {
                println!("--wipe requested: executing deep uninstall of models, Ollama, OpenCode, Hermes, and application cache...");
                let app_handle_wipe = app_handle.clone();
                tauri::async_runtime::block_on(async move {
                    execute_deep_wipe(&app_handle_wipe).await;
                });
                println!("--wipe: all components, credentials, and configurations successfully purged.");
            }

            crate::commands::system::log_event(
                &app_handle,
                "INFO",
                "INIT",
                &format!("FrugaLLM v{} initialized on {} {} (proxy: http://{}:{})", app.package_info().version, std::env::consts::OS, std::env::consts::ARCH, init_host, init_port),
            );

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

            // Populate dynamic roster chain on startup
            let roster_startup = dynamic_roster.clone();
            let app_handle_startup = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                let initial_chain = proxy::server::fetch_live_routing_chain(&app_handle_startup).await;
                if !initial_chain.is_empty() {
                    let mut guard = roster_startup.write().await;
                    *guard = initial_chain;
                }
            });

            // Provider Health State (in-memory circuit breaker and rate limit cooldowns)
            let health_state = ProviderHealthState::default();
            app.manage(health_state);

            // Start proxy server, health loop, and background Ollama daemon
            let server_handle = app_handle.clone();
            let initial_server_handle = tauri::async_runtime::spawn(async move { proxy::server::start_frugallm_server(server_handle).await; });
            let abort_clone = server_abort_handle.clone();
            tauri::async_runtime::spawn(async move { *abort_clone.lock().await = Some(initial_server_handle); });
            proxy::server::start_provider_health_loop(app_handle.clone());
            let ollama_handle = app_handle.clone();
            tauri::async_runtime::spawn(async move { let _ = commands::agents::start_ollama_daemon(&ollama_handle).await; });
            telemetry::start_telemetry_loop(app_handle.clone());

            // Handle Silent / Start Minimized / Automation Hidden Window Visibility and coordinate clamping
            if let Some(window) = app.get_webview_window("main") {
                if is_hidden || !should_show_window(is_silent, start_minimized) {
                    let _ = window.hide();
                } else {
                    validate_and_clamp_window_coordinates(&window);
                    let _ = window.show();
                }
            }

            #[cfg(unix)]
            setup_unix_signal_handlers(app_handle.clone());

            tray::setup_system_tray(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            set_model_override, get_launch_options,
            set_credential, get_credential, delete_credential, wipe_credentials,
            check_hermes_status, check_opencode_status, check_ollama_status,
            install_ollama, install_hermes, install_opencode,
            get_ollama_chat_model, get_hermes_version, get_opencode_version,
            uninstall_ollama, uninstall_opencode, uninstall_hermes,
            detect_vram, detect_hardware_profile,
            spawn_pty, write_pty, kill_pty, resize_pty,
            configure_hermes_defaults, configure_opencode_defaults,
            deploy_local_model, delete_local_model, get_frugallm_config, set_frugallm_config,
            get_provider_statuses, get_frugallm_server_status, retry_frugallm_server,
            edit_hermes_soul, open_app_logs,
            is_wipe_mode, get_local_ips, restart_app,
            get_routing_chain, set_routing_chain, refresh_routing_chain,
            check_tool_gateway_status, set_tool_gateway_installed,
            get_model_tag_for_vram,
            start_hermes_service, stop_hermes_service,
            has_active_services, get_active_services, confirm_exit_app, check_hermes_ready,
            set_global_cli_commands, get_global_cli_commands_status,
            get_diagnostic_data, submit_issue_report,
            launch_native_terminal, launch_native_app_session
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
        
    app.run(|app_handle, event| match event {
        tauri::RunEvent::ExitRequested { api, .. } => {
            handle_preventable_exit(app_handle, || api.prevent_exit());
        }
        tauri::RunEvent::WindowEvent { event: tauri::WindowEvent::CloseRequested { api, .. }, .. } => {
            #[cfg(target_os = "macos")]
            {
                api.prevent_close();
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                let close_to_tray = app_handle
                    .try_state::<FrugalConfigState>()
                    .and_then(|s| s.config.try_lock().ok().map(|c| c.close_to_tray))
                    .unwrap_or(true);

                if close_to_tray {
                    api.prevent_close();
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.hide();
                    }
                } else {
                    handle_preventable_exit(app_handle, || api.prevent_close());
                }
            }
        }
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen { .. } => {
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = app_handle.set_activation_policy(tauri::ActivationPolicy::Regular);
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        _ => {}
    });
}
