use std::sync::Arc;
use tauri::{Manager, Emitter};
use crate::state::*;
use crate::proxy::ChildProcessManager;

pub fn should_show_window(is_silent: bool, start_minimized: bool) -> bool {
    !(is_silent && start_minimized)
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct MonitorBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

pub fn is_window_rect_visible_on_monitors(
    win_x: i32,
    win_y: i32,
    win_w: u32,
    win_h: u32,
    monitors: &[MonitorBounds],
) -> bool {
    if monitors.is_empty() {
        return true;
    }
    let win_right = win_x + win_w as i32;
    let win_bottom = win_y + win_h as i32;

    for m in monitors {
        let m_right = m.x + m.width as i32;
        let m_bottom = m.y + m.height as i32;

        let overlap_left = win_x.max(m.x);
        let overlap_right = win_right.min(m_right);
        let overlap_top = win_y.max(m.y);
        let overlap_bottom = win_bottom.min(m_bottom);

        if overlap_right > overlap_left && overlap_bottom > overlap_top {
            let overlap_w = (overlap_right - overlap_left) as u32;
            let overlap_h = (overlap_bottom - overlap_top) as u32;
            if overlap_w >= 100 && overlap_h >= 100 {
                return true;
            }
        }
    }
    false
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WindowSize {
    pub width: u32,
    pub height: u32,
}

pub const TARGET_VIEWPORT_WIDTH: u32 = 1150;
pub const TARGET_VIEWPORT_HEIGHT: u32 = 750;
pub const MIN_VIEWPORT_WIDTH: u32 = 800;
pub const MIN_VIEWPORT_HEIGHT: u32 = 450;

/// Calculates a responsive viewport size that defaults to 1150x750
/// but scales down proportionally to fit comfortably on smaller displays (e.g. laptops)
/// with safe margins for OS docks, taskbars, and window decorations.
pub fn calculate_responsive_viewport_size(screen_width: u32, screen_height: u32) -> WindowSize {
    let max_avail_w = ((screen_width as f64) * 0.95).floor();
    let max_avail_h = ((screen_height as f64) * 0.90).floor();

    if max_avail_w >= (TARGET_VIEWPORT_WIDTH as f64) && max_avail_h >= (TARGET_VIEWPORT_HEIGHT as f64) {
        return WindowSize {
            width: TARGET_VIEWPORT_WIDTH,
            height: TARGET_VIEWPORT_HEIGHT,
        };
    }

    let target_ratio = (TARGET_VIEWPORT_WIDTH as f64) / (TARGET_VIEWPORT_HEIGHT as f64);
    let bound_w = max_avail_w.min(TARGET_VIEWPORT_WIDTH as f64);
    let bound_h = max_avail_h.min(TARGET_VIEWPORT_HEIGHT as f64);

    let (calc_w, _calc_h) = if bound_w / bound_h >= target_ratio {
        let h = bound_h;
        let w = h * target_ratio;
        (w, h)
    } else {
        let w = bound_w;
        let h = w / target_ratio;
        (w, h)
    };

    let clamped_w = calc_w.max(MIN_VIEWPORT_WIDTH as f64).round() as u32;
    let clamped_h = (clamped_w as f64 / target_ratio).round() as u32;

    WindowSize {
        width: clamped_w,
        height: clamped_h.max(MIN_VIEWPORT_HEIGHT),
    }
}

pub fn validate_and_clamp_window_coordinates(window: &tauri::WebviewWindow) {
    let monitor_opt = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());

    if let Some(monitor) = monitor_opt {
        let scale_factor = monitor.scale_factor();
        let phys_size = monitor.size();
        let logical_w = ((phys_size.width as f64) / scale_factor).round() as u32;
        let logical_h = ((phys_size.height as f64) / scale_factor).round() as u32;

        let target_size = calculate_responsive_viewport_size(logical_w, logical_h);
        let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: target_size.width as f64,
            height: target_size.height as f64,
        }));
        let _ = window.center();
    } else {
        let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: TARGET_VIEWPORT_WIDTH as f64,
            height: TARGET_VIEWPORT_HEIGHT as f64,
        }));
        let _ = window.center();
    }

    if let Ok(monitors) = window.available_monitors() {
        let bounds: Vec<MonitorBounds> = monitors
            .iter()
            .map(|m| MonitorBounds {
                x: m.position().x,
                y: m.position().y,
                width: m.size().width,
                height: m.size().height,
            })
            .collect();

        if let (Ok(pos), Ok(size)) = (window.outer_position(), window.outer_size()) {
            if !is_window_rect_visible_on_monitors(pos.x, pos.y, size.width, size.height, &bounds) {
                eprintln!("[WINDOW] Persisted coordinates ({}, {}) fall outside active monitors. Re-centering to primary display.", pos.x, pos.y);
                let _ = window.center();
            }
        }
    }
}

pub fn handle_single_instance(app: &tauri::AppHandle, argv: Vec<String>) {
    let is_silent = argv.iter().any(|arg| arg == "--silent" || arg == "--minimized");
    let is_wipe = argv.iter().any(|arg| arg == "--wipe");

    if is_wipe {
        eprintln!("[SINGLE_INSTANCE] --wipe requested: executing live deep wipe and resetting workspace...");
        let app_handle = app.clone();
        tauri::async_runtime::spawn(async move {
            crate::commands::agents::execute_deep_wipe(&app_handle).await;
            let _ = crate::db::wipe_credentials();
            if let Some(state) = app_handle.try_state::<FrugalConfigState>() {
                if let Ok(mut config) = state.config.try_lock() {
                    *config = FrugalConfig::default();
                    state.is_dirty.store(true, std::sync::atomic::Ordering::Release);
                }
            }
            if let Some(window) = app_handle.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                {
                    let _ = app_handle.set_activation_policy(tauri::ActivationPolicy::Regular);
                }
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.eval("try { localStorage.clear(); sessionStorage.clear(); } catch(e){} window.location.reload();");
            }
        });
        return;
    }

    if is_silent {
        return;
    }

    if let Some(window) = app.get_webview_window("main") {
        #[cfg(target_os = "macos")]
        {
            let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
        }
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn flush_config_on_exit(app_handle: &tauri::AppHandle) {
    let state = app_handle.state::<FrugalConfigState>();
    if state.is_dirty.swap(false, std::sync::atomic::Ordering::AcqRel) {
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

pub fn handle_preventable_exit(app_handle: &tauri::AppHandle, prevent: impl FnOnce()) {
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

#[cfg(unix)]
pub fn setup_unix_signal_handlers(app_handle: tauri::AppHandle) {
    use tokio::signal::unix::{signal, SignalKind};

    tauri::async_runtime::spawn(async move {
        let mut sigterm = match signal(SignalKind::terminate()) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[SIGNALS] Failed to register SIGTERM handler: {}", e);
                return;
            }
        };
        let mut sigint = match signal(SignalKind::interrupt()) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[SIGNALS] Failed to register SIGINT handler: {}", e);
                return;
            }
        };
        let mut sighup = match signal(SignalKind::hangup()) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[SIGNALS] Failed to register SIGHUP handler: {}", e);
                return;
            }
        };

        tokio::select! {
            _ = sigterm.recv() => {
                println!("[SIGNALS] Received SIGTERM, executing orderly child process cleanup...");
            }
            _ = sigint.recv() => {
                println!("[SIGNALS] Received SIGINT, executing orderly child process cleanup...");
            }
            _ = sighup.recv() => {
                println!("[SIGNALS] Received SIGHUP, executing orderly child process cleanup...");
            }
        }

        let process_manager = app_handle.state::<Arc<ChildProcessManager>>();
        process_manager.kill_all();
        flush_config_on_exit(&app_handle);
        std::process::exit(0);
    });
}
