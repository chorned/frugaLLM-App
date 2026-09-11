use crate::commands::agents::get_hermes_source_path;
use std::sync::Arc;
use tauri::{Emitter, Manager};

pub struct ChildProcessManager {
    processes: Arc<std::sync::Mutex<std::collections::HashMap<String, u32>>>,
}

impl Default for ChildProcessManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ChildProcessManager {
    pub fn new() -> Self {
        Self {
            processes: Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
        }
    }

    pub fn register(&self, key: String, pid: u32) {
        if let Ok(mut lock) = self.processes.lock() {
            lock.insert(key, pid);
        }
    }

    pub fn unregister(&self, key: &str) {
        if let Ok(mut lock) = self.processes.lock() {
            lock.remove(key);
        }
    }

    pub fn kill_process(&self, key: &str) {
        let pid_opt = if let Ok(mut lock) = self.processes.lock() {
            lock.remove(key)
        } else {
            None
        };

        if let Some(pid) = pid_opt {
            kill_pid_and_children(pid);
        }
    }

    pub fn has_active_services(&self) -> bool {
        if let Ok(lock) = self.processes.lock() {
            !lock.is_empty()
        } else {
            false
        }
    }

    pub fn active_service_names(&self) -> Vec<String> {
        if let Ok(lock) = self.processes.lock() {
            lock.keys().cloned().collect()
        } else {
            vec![]
        }
    }

    pub fn kill_all(&self) {
        let pids: Vec<u32> = if let Ok(mut lock) = self.processes.lock() {
            let pids = lock.values().copied().collect();
            lock.clear();
            pids
        } else {
            vec![]
        };

        for pid in pids {
            kill_pid_and_children(pid);
        }

        #[cfg(not(windows))]
        {
            let _ = std::process::Command::new("pkill")
                .args(["-9", "-f", "hermes dashboard"])
                .status();
            let _ = std::process::Command::new("pkill")
                .args(["-9", "-f", "hermes gateway"])
                .status();
            let _ = std::process::Command::new("pkill")
                .args(["-9", "-f", "hermes desktop"])
                .status();
            let _ = std::process::Command::new("pkill")
                .args(["-9", "-f", "hermes serve"])
                .status();
        }
        #[cfg(windows)]
        {
            let _ = std::process::Command::new("taskkill")
                .args(&["/IM", "hermes.exe", "/F", "/T"])
                .status();
        }
    }
}

impl Drop for ChildProcessManager {
    fn drop(&mut self) {
        self.kill_all();
    }
}

pub fn kill_pid_and_children(pid: u32) {
    if pid == 0 {
        return;
    }
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("taskkill")
            .args(&["/F", "/T", "/PID", &pid.to_string()])
            .status();
    }
    #[cfg(not(windows))]
    {
        // First send SIGTERM to children and parent
        let _ = std::process::Command::new("pkill")
            .args(["-TERM", "-P", &pid.to_string()])
            .status();
        let _ = std::process::Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .status();

        std::thread::sleep(std::time::Duration::from_millis(50));

        // Follow with SIGKILL
        let _ = std::process::Command::new("pkill")
            .args(["-9", "-P", &pid.to_string()])
            .status();
        let _ = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .status();
    }
}

pub async fn spawn_hermes_child(
    app: &tauri::AppHandle,
    process_state: &Arc<ChildProcessManager>,
    port: u16,
    api_pwd: Option<String>,
    service: &str,
) -> Result<u32, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let hermes_bin = get_hermes_source_path(&home).unwrap_or_else(|| {
        std::path::PathBuf::from(if cfg!(windows) {
            "hermes.exe"
        } else {
            "hermes"
        })
    });

    let subcmd = match service {
        "gateway" | "hermes-gateway" | "desktop" | "hermes-desktop" => "gateway",
        "dashboard" | "hermes-dashboard" | "web" | "hermes-web" => "dashboard",
        other => other,
    };

    let mut cmd = tokio::process::Command::new(&hermes_bin);
    cmd.arg(subcmd);
    // Explicitly bind to 127.0.0.1 for local isolation and security
    cmd.args(["--host", "127.0.0.1"]);
    cmd.env("OPENAI_API_BASE", format!("http://127.0.0.1:{}/v1", port));
    cmd.env(
        "OPENAI_API_KEY",
        api_pwd.unwrap_or_else(|| "frugallm".to_string()),
    );

    let hermes_bin_dir = home.join(".hermes").join("bin");
    let local_bin_dir = home.join(".local").join("bin");
    let cargo_bin_dir = home.join(".cargo").join("bin");
    let current_path = std::env::var("PATH").unwrap_or_default();
    let sep = if cfg!(windows) { ";" } else { ":" };
    let new_path = if cfg!(windows) {
        format!(
            "{}{}{}{}{}{}{}",
            local_bin_dir.display(),
            sep,
            hermes_bin_dir.display(),
            sep,
            cargo_bin_dir.display(),
            sep,
            current_path
        )
    } else {
        format!(
            "{}:{}:{}:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:{}",
            local_bin_dir.display(),
            hermes_bin_dir.display(),
            cargo_bin_dir.display(),
            current_path
        )
    };
    cmd.env("PATH", new_path);

    cmd.stdout(std::process::Stdio::null());
    cmd.stderr(std::process::Stdio::null());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn hermes {}: {}", subcmd, e))?;
    let pid = child
        .id()
        .ok_or_else(|| "Failed to get child PID".to_string())?;

    let service_key = format!("hermes-{}", subcmd);
    process_state.register(service_key.clone(), pid);

    let process_state_clone = process_state.clone();
    let app_clone = app.clone();
    let service_key_clone = service_key.clone();
    tokio::spawn(async move {
        let _ = child.wait().await;
        process_state_clone.unregister(&service_key_clone);
        let _ = app_clone.emit(
            "service_exit",
            serde_json::json!({ "service": service_key_clone }),
        );
    });

    Ok(pid)
}
