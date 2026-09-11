use std::sync::Arc;
use tauri::{Manager, State, Emitter};
use crate::state::*;
use crate::proxy::ChildProcessManager;


#[tauri::command]
pub fn spawn_pty(
    app: tauri::AppHandle,
    state: State<'_, PtyState>,
    process_state: State<'_, Arc<ChildProcessManager>>,
    session_id: String,
    command: Option<String>,
    args: Option<Vec<String>>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<(), String> {
    use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
    use std::io::Read;

    let pty_system = NativePtySystem::default();
    let pair = pty_system.openpty(PtySize {
        rows: rows.unwrap_or(24),
        cols: cols.unwrap_or(80),
        pixel_width: 0,
        pixel_height: 0,
    }).map_err(|e| e.to_string())?;

    let mut cmd = if let Some(c) = command {
        CommandBuilder::new(c)
    } else if cfg!(windows) {
        CommandBuilder::new("powershell.exe")
    } else {
        CommandBuilder::new("bash")
    };

    if let Ok(home) = app.path().home_dir() {
        let local_bin = home.join(".local").join("bin");
        let hermes_bin = home.join(".hermes").join("bin");
        let opencode_bin = home.join(".opencode").join("bin");
        let cargo_bin = home.join(".cargo").join("bin");
        let current_path = std::env::var("PATH").unwrap_or_default();
        let sep = if cfg!(windows) { ";" } else { ":" };
        let augmented_path = if cfg!(windows) {
            let local_appdata = std::env::var("LOCALAPPDATA")
                .map(std::path::PathBuf::from)
                .unwrap_or_else(|_| home.join("AppData").join("Local"));
            let appdata = std::env::var("APPDATA")
                .map(std::path::PathBuf::from)
                .unwrap_or_else(|_| home.join("AppData").join("Roaming"));
            let npm_bin = appdata.join("npm");
            let hermes_local_appdata = local_appdata.join("hermes").join("bin");
            let opencode_local_appdata = local_appdata.join("Programs").join("opencode");
            let ollama_local_appdata = local_appdata.join("Programs").join("Ollama");
            format!(
                "{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}",
                npm_bin.display(),
                sep,
                hermes_local_appdata.display(),
                sep,
                opencode_local_appdata.display(),
                sep,
                ollama_local_appdata.display(),
                sep,
                local_bin.display(),
                sep,
                hermes_bin.display(),
                sep,
                opencode_bin.display(),
                sep,
                cargo_bin.display(),
                sep,
                current_path
            )
        } else {
            format!(
                "{}:{}:{}:{}:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:{}",
                local_bin.display(),
                hermes_bin.display(),
                opencode_bin.display(),
                cargo_bin.display(),
                current_path
            )
        };
        cmd.env("PATH", augmented_path);
    }

    if let Some(a) = args {
        cmd.args(&a);
    }
    
    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    if let Some(pid) = child.process_id() {
        process_state.register(session_id.clone(), pid);
    }

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    
    if let Ok(mut state_writer) = state.writer.lock() {
        state_writer.insert(session_id.clone(), writer);
    }
    
    if let Ok(mut state_master) = state.master.lock() {
        state_master.insert(session_id.clone(), pair.master);
    }

    let app_clone = app.clone();
    let session_id_clone = session_id.clone();
    let process_state_clone = process_state.inner().clone();
    std::thread::spawn(move || {
        let exit_code = match child.wait() {
            Ok(status) => if status.success() { 0 } else { 1 },
            Err(e) => {
                eprintln!("[pty] process wait error on session {}: {}", session_id_clone, e);
                1
            }
        };
        process_state_clone.unregister(&session_id_clone);
        #[derive(serde::Serialize, Clone)]
        struct ExitPayload {
            session_id: String,
            exit_code: u32,
        }
        let _ = app_clone.emit("pty_exit", ExitPayload { session_id: session_id_clone, exit_code });
    });

    std::thread::spawn(move || {
        let mut buf = [0u8; 16384];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let s = String::from_utf8_lossy(&buf[..n]);
                    #[derive(serde::Serialize, Clone)]
                    struct OutputPayload {
                        session_id: String,
                        data: String,
                    }
                    let _ = app.emit("pty_output", OutputPayload { session_id: session_id.clone(), data: s.into_owned() });
                }
                Err(e) => {
                    eprintln!("[pty] output reader error on session {}: {}", session_id, e);
                    break;
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub fn write_pty(state: State<'_, PtyState>, session_id: String, data: String) -> Result<(), String> {
    if let Ok(mut writers) = state.writer.lock() {
        if let Some(writer) = writers.get_mut(&session_id) {
            writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
            writer.flush().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn kill_pty(
    state: State<'_, PtyState>,
    process_state: State<'_, Arc<ChildProcessManager>>,
    session_id: String
) -> Result<(), String> {
    if let Ok(mut writers) = state.writer.lock() {
        writers.remove(&session_id);
    }
    if let Ok(mut masters) = state.master.lock() {
        masters.remove(&session_id);
    }
    process_state.kill_process(&session_id);
    Ok(())
}

#[tauri::command]
pub fn resize_pty(state: State<'_, PtyState>, session_id: String, rows: u16, cols: u16) -> Result<(), String> {
    if let Ok(mut masters) = state.master.lock() {
        if let Some(master) = masters.get_mut(&session_id) {
            master.resize(portable_pty::PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            }).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}


