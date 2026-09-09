use std::sync::Arc;
use tauri::{Manager, Emitter};
use crate::proxy::ChildProcessManager;


pub fn setup_system_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let toggle_item = tauri::menu::MenuItem::with_id(app, "toggle", "Show/Hide Window", true, None::<&str>)?;
    let quit_item = tauri::menu::MenuItem::with_id(app, "quit", "Quit FrugaLLM", true, None::<&str>)?;
    let tray_menu = tauri::menu::Menu::with_items(app, &[&toggle_item, &quit_item])?;

    let mut tray_builder = tauri::tray::TrayIconBuilder::new()
        .menu(&tray_menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle" => {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.unminimize();
                    }
                }
            }
            "quit" => {
                let process_manager = app.state::<Arc<ChildProcessManager>>();
                let allow_exit = app.state::<Arc<std::sync::atomic::AtomicBool>>();
                let has_active = process_manager.has_active_services();
                if has_active {
                    let _ = app.emit("request_exit_confirmation", ());
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.unminimize();
                    }
                } else {
                    allow_exit.store(true, std::sync::atomic::Ordering::Release);
                    crate::flush_config_on_exit(app);
                    app.exit(0);
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.unminimize();
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray_builder = tray_builder.icon(icon.clone());
    }

    tray_builder.build(app)?;
    Ok(())
}
