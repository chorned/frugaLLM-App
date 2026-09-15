use std::sync::Arc;
use tauri::{Manager, Emitter};
use crate::commands::agents::get_hermes_source_path;

#[cfg(windows)]
pub struct WindowsJobObject {
    handle: windows_sys::Win32::Foundation::HANDLE,
}

#[cfg(windows)]
unsafe impl Send for WindowsJobObject {}
#[cfg(windows)]
unsafe impl Sync for WindowsJobObject {}

#[cfg(windows)]
impl WindowsJobObject {
    pub fn new() -> Option<Self> {
        use windows_sys::Win32::System::JobObjects::*;
        use windows_sys::Win32::Foundation::*;
        
        unsafe {
            let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if handle == 0 || handle == INVALID_HANDLE_VALUE {
                return None;
            }
            
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            
            let res = SetInformationJobObject(
                handle,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );
            
            if res == 0 {
                CloseHandle(handle);
                None
            } else {
                Some(Self { handle })
            }
        }
    }
    
    pub fn assign_process(&self, process_handle: windows_sys::Win32::Foundation::HANDLE) -> bool {
        use windows_sys::Win32::System::JobObjects::AssignProcessToJobObject;
        if self.handle == 0 || self.handle == windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE {
            return false;
        }
        unsafe {
            AssignProcessToJobObject(self.handle, process_handle) != 0
        }
    }

    pub fn assign_pid(&self, pid: u32) -> bool {
        use windows_sys::Win32::System::Threading::*;
        use windows_sys::Win32::Foundation::*;
        unsafe {
            let handle = OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid);
            if handle != 0 && handle != INVALID_HANDLE_VALUE {
                let success = self.assign_process(handle);
                CloseHandle(handle);
                success
            } else {
                false
            }
        }
    }
}

#[cfg(windows)]
impl Drop for WindowsJobObject {
    fn drop(&mut self) {
        if self.handle != 0 && self.handle != windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE {
            unsafe {
                windows_sys::Win32::Foundation::CloseHandle(self.handle);
            }
        }
    }
}

pub struct ChildProcessManager {
    processes: Arc<std::sync::Mutex<std::collections::HashMap<String, u32>>>,
    #[cfg(windows)]
    job_object: Option<Arc<WindowsJobObject>>,
}

impl Default for ChildProcessManager {
    fn default() -> Self {
        Self::new()
    }
}

impl ChildProcessManager {
    pub fn new() -> Self {
        #[cfg(windows)]
        let job_object = WindowsJobObject::new().map(Arc::new);

        Self {
            processes: Arc::new(std::sync::Mutex::new(std::collections::HashMap::new())),
            #[cfg(windows)]
            job_object,
        }
    }

    pub fn register(&self, key: String, pid: u32) {
        if let Ok(mut lock) = self.processes.lock() {
            lock.insert(key, pid);
        }
        #[cfg(windows)]
        if let Some(ref job) = self.job_object {
            job.assign_pid(pid);
        }
    }

    pub fn assign_pid_to_job(&self, pid: u32) {
        #[cfg(windows)]
        if let Some(ref job) = self.job_object {
            job.assign_pid(pid);
        }
        #[cfg(not(windows))]
        let _ = pid;
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
            let _ = std::process::Command::new("pkill").args(["-9", "-f", "hermes dashboard"]).status();
            let _ = std::process::Command::new("pkill").args(["-9", "-f", "hermes gateway"]).status();
            let _ = std::process::Command::new("pkill").args(["-9", "-f", "hermes desktop"]).status();
            let _ = std::process::Command::new("pkill").args(["-9", "-f", "hermes serve"]).status();
            let _ = std::process::Command::new("pkill").args(["-9", "-f", "opencode"]).status();
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            let mut cmd = std::process::Command::new("taskkill");
            cmd.args(&["/IM", "hermes.exe", "/IM", "opencode.exe", "/F", "/T"])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .creation_flags(0x08000000);
            let _ = cmd.status();
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
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("taskkill");
        cmd.args(&["/F", "/T", "/PID", &pid.to_string()])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .creation_flags(0x08000000);
        let _ = cmd.status();
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
        std::path::PathBuf::from(if cfg!(windows) { "hermes.exe" } else { "hermes" })
    });

    let subcmd = match service {
        "gateway" | "hermes-gateway" | "desktop" | "hermes-desktop" => "gateway",
        "dashboard" | "hermes-dashboard" | "web" | "hermes-web" => "dashboard",
        other => other,
    };

    let is_cmd = hermes_bin
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("cmd") || ext.eq_ignore_ascii_case("bat"));

    let mut cmd = if cfg!(windows) && is_cmd {
        let mut c = tokio::process::Command::new("cmd.exe");
        c.arg("/C").arg(format!("\"{}\"", hermes_bin.display()));
        c
    } else {
        tokio::process::Command::new(&hermes_bin)
    };

    cmd.arg(subcmd);
    // Explicitly bind to 127.0.0.1 for local isolation and security
    cmd.args(["--host", "127.0.0.1"]);
    cmd.env("OPENAI_API_BASE", format!("http://127.0.0.1:{}/v1", port));
    cmd.env("OPENAI_API_KEY", api_pwd.unwrap_or_else(|| "frugallm".to_string()));

    let hermes_bin_dir = home.join(".hermes").join("bin");
    let local_bin_dir = home.join(".local").join("bin");
    let cargo_bin_dir = home.join(".cargo").join("bin");

    let mut paths: Vec<std::path::PathBuf> = Vec::new();
    if cfg!(windows) {
        let local_appdata = std::env::var_os("LOCALAPPDATA")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| home.join("AppData").join("Local"));
        paths.push(local_appdata.join("hermes").join("bin"));
        paths.push(local_bin_dir);
        paths.push(hermes_bin_dir);
        paths.push(cargo_bin_dir);
    } else {
        paths.push(local_bin_dir);
        paths.push(hermes_bin_dir);
        paths.push(cargo_bin_dir);
        paths.push(std::path::PathBuf::from("/opt/homebrew/bin"));
        paths.push(std::path::PathBuf::from("/opt/homebrew/sbin"));
        paths.push(std::path::PathBuf::from("/usr/local/bin"));
    }

    if let Some(existing) = std::env::var_os("PATH") {
        paths.extend(std::env::split_paths(&existing));
    }

    if let Ok(joined) = std::env::join_paths(paths) {
        cmd.env("PATH", joined);
    }

    cmd.stdout(std::process::Stdio::null());
    cmd.stderr(std::process::Stdio::null());

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000);
    }

    #[cfg(target_os = "linux")]
    unsafe {
        cmd.pre_exec(|| {
            libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGKILL);
            Ok(())
        });
    }

    cmd.kill_on_drop(true);

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn hermes {}: {}", subcmd, e))?;
    let pid = child.id().ok_or_else(|| "Failed to get child PID".to_string())?;

    let service_key = format!("hermes-{}", subcmd);
    process_state.register(service_key.clone(), pid);

    let process_state_clone = process_state.clone();
    let app_clone = app.clone();
    let service_key_clone = service_key.clone();
    tokio::spawn(async move {
        let _ = child.wait().await;
        process_state_clone.unregister(&service_key_clone);
        let _ = app_clone.emit("service_exit", serde_json::json!({ "service": service_key_clone }));
    });

    Ok(pid)
}

