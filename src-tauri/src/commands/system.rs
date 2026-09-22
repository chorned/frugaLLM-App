use tauri::Manager;
use crate::telemetry::HardwareProfile;
use crate::state::*;

static CACHED_PROFILE: tokio::sync::OnceCell<HardwareProfile> = tokio::sync::OnceCell::const_new();

pub async fn get_hardware_profile() -> Result<HardwareProfile, String> {
    if let Some(profile) = CACHED_PROFILE.get() {
        return Ok(profile.clone());
    }
    let profile = detect_hardware_profile_internal().await?;
    let _ = CACHED_PROFILE.set(profile.clone());
    Ok(profile)
}

pub async fn is_hardware_accelerated() -> bool {
    if let Ok(profile) = get_hardware_profile().await {
        profile.is_unified || profile.dedicated_vram >= 4 * 1024 * 1024 * 1024
    } else {
        false
    }
}

async fn detect_hardware_profile_internal() -> Result<HardwareProfile, String> {
    let is_unified: bool;
    #[allow(unused_assignments)]
    let mut dedicated_vram: u64 = 0;
    #[allow(unused_mut)]
    let mut system_ram: u64;
    let os_architecture: String;

    #[cfg(target_os = "macos")]
    {
        system_ram = 0;
        let is_arm = std::env::consts::ARCH == "aarch64";
        os_architecture = format!("macos-{}", std::env::consts::ARCH);

        // Query total system RAM via sysctl hw.memsize
        if let Ok(output) = tokio::process::Command::new("sysctl").arg("-n").arg("hw.memsize").output().await {
            if output.status.success() {
                if let Ok(s) = String::from_utf8(output.stdout) {
                    if let Ok(bytes) = s.trim().parse::<u64>() {
                        system_ram = bytes;
                    }
                }
            }
        }

        if is_arm {
            // Apple Silicon Unified Memory: Do not differentiate RAM/VRAM
            is_unified = true;
            dedicated_vram = 0;
        } else {
            // Intel Mac: Detect discrete GPU via system_profiler
            is_unified = false;
            if let Ok(output) = tokio::process::Command::new("system_profiler").arg("SPDisplaysDataType").output().await {
                if output.status.success() {
                    if let Ok(prof_str) = String::from_utf8(output.stdout) {
                        let mut max_vram_mb: u64 = 0;
                        for line in prof_str.lines() {
                            if line.contains("VRAM (Total):") || line.contains("VRAM (Dynamic, Max):") {
                                let parts: Vec<&str> = line.split(':').collect();
                                if parts.len() > 1 {
                                    let val_str = parts[1].trim();
                                    let val_parts: Vec<&str> = val_str.split_whitespace().collect();
                                    if val_parts.len() == 2 {
                                        if let Ok(mut val) = val_parts[0].parse::<u64>() {
                                            if val_parts[1] == "GB" {
                                                val *= 1024;
                                            }
                                            if val > max_vram_mb {
                                                max_vram_mb = val;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        dedicated_vram = max_vram_mb * 1024 * 1024;
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        os_architecture = format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH);
        is_unified = false;

        let mut sys = sysinfo::System::new_all();
        sys.refresh_memory();
        system_ram = sys.total_memory();

        dedicated_vram = detect_windows_discrete_vram().await;
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        os_architecture = format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH);
        is_unified = false;

        let mut sys = sysinfo::System::new_all();
        sys.refresh_memory();
        system_ram = sys.total_memory();

        // NVIDIA NVML check
        use nvml_wrapper::Nvml;
        if let Ok(nvml) = Nvml::init() {
            if let Ok(device) = nvml.device_by_index(0) {
                if let Ok(memory) = device.memory_info() {
                    dedicated_vram = memory.total;
                }
            }
        }
    }

    let execution_ceiling = if is_unified {
        // Unified Memory minus ~2GB macOS reserve buffer
        system_ram.saturating_sub(2 * 1024 * 1024 * 1024)
    } else if dedicated_vram > 0 {
        dedicated_vram
    } else if system_ram > 0 {
        system_ram.saturating_sub(2 * 1024 * 1024 * 1024)
    } else {
        8 * 1024 * 1024 * 1024
    };

    Ok(HardwareProfile {
        is_unified,
        dedicated_vram,
        system_ram,
        execution_ceiling,
        os_architecture,
    })
}

#[tauri::command(async)]
pub async fn detect_hardware_profile() -> Result<HardwareProfile, String> {
    get_hardware_profile().await
}

#[tauri::command(async)]
pub async fn detect_vram() -> Result<u64, String> {
    let profile = get_hardware_profile().await?;
    if profile.is_unified {
        Ok(profile.execution_ceiling / 1024 / 1024)
    } else if profile.dedicated_vram > 0 {
        Ok(profile.dedicated_vram / 1024 / 1024)
    } else {
        Ok(profile.system_ram / 1024 / 1024)
    }
}

pub fn parse_registry_vram_output(output: &str) -> u64 {
    let mut max_bytes = 0u64;
    for line in output.lines() {
        if line.contains("REG_QWORD") || line.contains("REG_DWORD") {
            if let Some(val_str) = line.split_whitespace().last() {
                let hex_str = val_str.trim().trim_start_matches("0x").trim_start_matches("0X");
                if let Ok(bytes) = u64::from_str_radix(hex_str, 16) {
                    if bytes > max_bytes {
                        max_bytes = bytes;
                    }
                }
            }
        }
    }
    max_bytes
}

#[cfg(target_os = "windows")]
pub async fn detect_windows_discrete_vram() -> u64 {
    // Tier 1: Try NVIDIA NVML first
    use nvml_wrapper::Nvml;
    if let Ok(nvml) = Nvml::init() {
        if let Ok(device) = nvml.device_by_index(0) {
            if let Ok(memory) = device.memory_info() {
                if memory.total > 0 {
                    return memory.total;
                }
            }
        }
    }

    // Tier 2: Query 64-bit HardwareInformation.qwMemorySize from Windows Registry (NVIDIA, AMD Radeon, Intel Arc)
    if let Ok(output) = tokio::process::Command::new("reg")
        .args([
            "query",
            r"HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}",
            "/s",
            "/v",
            "HardwareInformation.qwMemorySize",
        ])
        .creation_flags(0x08000000)
        .output()
        .await
    {
        if output.status.success() {
            if let Ok(stdout) = String::from_utf8(output.stdout) {
                let max_bytes = parse_registry_vram_output(&stdout);
                if max_bytes > 0 {
                    return max_bytes;
                }
            }
        }
    }

    // Tier 3: Query nvidia-smi if available in PATH
    if let Ok(output) = tokio::process::Command::new("nvidia-smi")
        .args(["--query-gpu=memory.total", "--format=csv,noheader,nounits"])
        .creation_flags(0x08000000)
        .output()
        .await
    {
        if output.status.success() {
            if let Ok(stdout) = String::from_utf8(output.stdout) {
                for line in stdout.lines() {
                    if let Ok(mib) = line.trim().parse::<u64>() {
                        if mib > 0 {
                            return mib * 1024 * 1024;
                        }
                    }
                }
            }
        }
    }

    // Tier 4: Fallback to PowerShell CIM Win32_VideoController AdapterRAM
    if let Ok(output) = tokio::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Measure-Object -Property AdapterRAM -Maximum).Maximum",
        ])
        .creation_flags(0x08000000)
        .output()
        .await
    {
        if output.status.success() {
            if let Ok(stdout) = String::from_utf8(output.stdout) {
                if let Ok(bytes) = stdout.trim().parse::<u64>() {
                    if bytes > 0 {
                        return bytes;
                    }
                }
            }
        }
    }

    0
}


pub fn format_log_entry(level: &str, tag: &str, message: &str) -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("[{}] [{}] [{}] {}\n", now, level, tag, message)
}

pub const MAX_LOG_FILE_SIZE_BYTES: u64 = 10 * 1024 * 1024; // 10 MB
pub const MAX_ROTATED_LOG_FILES: usize = 5;

pub fn rotate_logs_if_needed(path: &std::path::Path, incoming_bytes: u64, max_size: u64, max_files: usize) -> std::io::Result<()> {
    if !path.exists() {
        return Ok(());
    }

    let current_size = match path.metadata() {
        Ok(m) => m.len(),
        Err(_) => return Ok(()),
    };

    if current_size + incoming_bytes > max_size {
        let parent = match path.parent() {
            Some(p) => p,
            None => return Ok(()),
        };

        for i in (1..max_files).rev() {
            let old_file = parent.join(format!("frugallm.{}.log", i));
            let new_file = parent.join(format!("frugallm.{}.log", i + 1));
            if old_file.exists() {
                let _ = std::fs::rename(&old_file, &new_file);
            }
        }

        let first_rotated = parent.join("frugallm.1.log");
        let _ = std::fs::rename(path, &first_rotated);
    }

    Ok(())
}

pub fn append_log_entry_to_path(path: &std::path::Path, level: &str, tag: &str, message: &str) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)?;
        }
    }
    let entry = format_log_entry(level, tag, message);
    let _ = rotate_logs_if_needed(path, entry.len() as u64, MAX_LOG_FILE_SIZE_BYTES, MAX_ROTATED_LOG_FILES);

    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?;
    file.write_all(entry.as_bytes())?;
    Ok(())
}

pub fn get_app_log_file_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let log_dir = app_data_dir.join("logs");
    if !log_dir.exists() {
        let _ = std::fs::create_dir_all(&log_dir);
    }
    Ok(log_dir.join("frugallm.log"))
}

pub fn log_event(app: &tauri::AppHandle, level: &str, tag: &str, message: &str) {
    let stdout_line = format!("[{}] [{}] {}", level, tag, message);
    println!("{}", stdout_line);
    if let Ok(path) = get_app_log_file_path(app) {
        let _ = append_log_entry_to_path(&path, level, tag, message);
    }
}

pub fn open_file_in_system_viewer(app: &tauri::AppHandle, path: &std::path::Path) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let path_str = path.to_string_lossy();
    
    if let Err(e) = app.opener().open_path(path_str.as_ref(), None::<&str>) {
        log_event(app, "WARN", "OPENER", &format!("app.opener().open_path failed for {}: {}. Attempting fallback.", path.display(), e));
        
        #[cfg(target_os = "windows")]
        {
            let res = std::process::Command::new("notepad.exe").arg(path).spawn();
            if let Err(err) = res {
                let err_msg = format!("Failed to open file in editor: {}", err);
                log_event(app, "ERROR", "OPENER", &err_msg);
                return Err(err_msg);
            }
            return Ok(());
        }
        #[cfg(target_os = "macos")]
        {
            let res = std::process::Command::new("open").arg("-t").arg(path).spawn();
            if let Err(err) = res {
                let err_msg = format!("Failed to open file in editor: {}", err);
                log_event(app, "ERROR", "OPENER", &err_msg);
                return Err(err_msg);
            }
            return Ok(());
        }
        #[cfg(target_os = "linux")]
        {
            let res = std::process::Command::new("xdg-open").arg(path).spawn();
            if let Err(err) = res {
                let err_msg = format!("Failed to open file in editor: {}", err);
                log_event(app, "ERROR", "OPENER", &err_msg);
                return Err(err_msg);
            }
            return Ok(());
        }
    }
    Ok(())
}

#[tauri::command]
pub fn open_app_logs(app: tauri::AppHandle) -> Result<(), String> {
    let log_path = get_app_log_file_path(&app)?;
    if !log_path.exists() {
        let _ = append_log_entry_to_path(&log_path, "INFO", "INIT", "FrugaLLM log initialized");
    }
    open_file_in_system_viewer(&app, &log_path)
}

pub fn sanitize_diagnostic_logs(raw_logs: &str) -> String {
    let key_regex = regex::Regex::new(r"(sk-[a-zA-Z0-9_\-]{20,}|AIza[a-zA-Z0-9_\-]{16,}|Bearer\s+[a-zA-Z0-9_\.\-]+)").unwrap();
    key_regex.replace_all(raw_logs, "[REDACTED_API_KEY]").to_string()
}

pub fn read_last_n_lines(path: &std::path::Path, n: usize) -> std::io::Result<String> {
    use std::io::{BufRead, BufReader, Seek, SeekFrom};
    let mut file = std::fs::File::open(path)?;
    let metadata = file.metadata()?;
    let file_len = metadata.len();

    let max_read_chunk: u64 = 512 * 1024; // Bounded to 512KB to protect RAM
    let seek_offset = file_len.saturating_sub(max_read_chunk);
    if seek_offset > 0 {
        file.seek(SeekFrom::Start(seek_offset))?;
    }

    let reader = BufReader::new(file);
    let mut lines: Vec<String> = reader.lines().map_while(Result::ok).collect();
    if seek_offset > 0 && !lines.is_empty() {
        lines.remove(0);
    }

    let start = lines.len().saturating_sub(n);
    Ok(lines[start..].join("\n"))
}

pub fn check_available_disk_space(target_path: &std::path::Path, required_bytes: u64) -> Result<(), String> {
    use sysinfo::Disks;
    let disks = Disks::new_with_refreshed_list();
    
    let mut matching_disk = None;
    let mut longest_mount_len = 0;
    
    for disk in &disks {
        let mount = disk.mount_point();
        if target_path.starts_with(mount) {
            let mount_len = mount.as_os_str().len();
            if mount_len >= longest_mount_len {
                longest_mount_len = mount_len;
                matching_disk = Some(disk);
            }
        }
    }
    
    if let Some(disk) = matching_disk {
        let available = disk.available_space();
        if available < required_bytes {
            let available_gb = available as f64 / 1024.0 / 1024.0 / 1024.0;
            let required_gb = required_bytes as f64 / 1024.0 / 1024.0 / 1024.0;
            return Err(format!(
                "Insufficient disk space: {:.2} GB available on {}, but {:.2} GB is required.",
                available_gb,
                disk.mount_point().display(),
                required_gb
            ));
        }
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn format_diagnostic_snapshot_header(
    app_version: &str,
    os_info: &str,
    total_mem_gb: f64,
    avail_mem_gb: f64,
    cpu_cores: usize,
    proxy_endpoint: &str,
    paid_fallback: bool,
    tool_enforcement: bool,
) -> String {
    format!(
        "=== FRUGALLM SYSTEM DIAGNOSTICS SNAPSHOT ===\n\
         App Version: {}\n\
         Platform / Arch: {}\n\
         System Memory: {:.2} GB total, {:.2} GB available\n\
         CPU Cores: {}\n\
         Proxy Endpoint: {}\n\
         Paid Fallback: {}\n\
         Tool Enforcement: {}\n\
         ============================================\n\n",
        app_version,
        os_info,
        total_mem_gb,
        avail_mem_gb,
        cpu_cores,
        proxy_endpoint,
        paid_fallback,
        tool_enforcement
    )
}

#[tauri::command]
pub async fn get_diagnostic_data(app: tauri::AppHandle) -> Result<DiagnosticPayload, String> {
    let log_path = match get_app_log_file_path(&app) {
        Ok(p) if p.exists() => Some(p),
        _ => {
            if let Ok(log_dir) = app.path().app_log_dir() {
                let fallback = log_dir.join("frugallm.log");
                if fallback.exists() {
                    Some(fallback)
                } else {
                    None
                }
            } else {
                None
            }
        }
    };

    let raw_logs = if let Some(path) = log_path {
        read_last_n_lines(&path, 400).unwrap_or_else(|e| format!("Failed to read log file: {}", e))
    } else {
        "No log file found on disk.".to_string()
    };

    let sanitized_logs = sanitize_diagnostic_logs(&raw_logs);

    let (proxy_endpoint, paid_fallback, tool_enforcement) = if let Some(state) = app.try_state::<crate::state::FrugalConfigState>() {
        if let Ok(config) = state.config.try_lock() {
            let host = if config.bind_all_interfaces { "0.0.0.0" } else { "127.0.0.1" };
            (
                format!("http://{}:{}", host, config.port),
                config.enable_paid_fallback,
                config.tool_enforcing_gateway,
            )
        } else {
            ("http://127.0.0.1:61721".to_string(), true, false)
        }
    } else {
        ("http://127.0.0.1:61721".to_string(), true, false)
    };

    use sysinfo::System;
    let mut sys = System::new_all();
    sys.refresh_all();
    let total_mem_gb = sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let avail_mem_gb = sys.available_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let cpu_cores = sys.cpus().len();

    let app_version = app.package_info().version.to_string();
    let os_info = format!("{} {}", std::env::consts::OS, std::env::consts::ARCH);

    let header = format_diagnostic_snapshot_header(
        &app_version,
        &os_info,
        total_mem_gb,
        avail_mem_gb,
        cpu_cores,
        &proxy_endpoint,
        paid_fallback,
        tool_enforcement,
    );

    let full_logs = format!("{}{}", header, sanitized_logs);

    Ok(DiagnosticPayload {
        app_version,
        os_info,
        logs: full_logs,
    })
}

#[tauri::command]
pub async fn submit_issue_report(payload: SubmitIssuePayload) -> Result<String, String> {
    let access_key = payload
        .access_key
        .filter(|k| !k.trim().is_empty() && k != "YOUR_ACCESS_KEY_HERE")
        .or_else(|| std::env::var("VITE_WEB3FORMS_ACCESS_KEY").ok())
        .or_else(|| std::env::var("WEB3FORMS_ACCESS_KEY").ok())
        .unwrap_or_else(|| "4864c240-bf9b-40cf-82b3-e24c1766a559".to_string());

    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let res = client
        .post("https://api.web3forms.com/submit")
        .header("Origin", "https://frugallm.app")
        .header("Referer", "https://frugallm.app/")
        .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .json(&serde_json::json!({
            "access_key": access_key,
            "subject": payload.subject,
            "from_name": payload.from_name,
            "email": payload.email,
            "message": payload.message,
        }))
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    let status = res.status();
    let body = res.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("Web3Forms error (HTTP {}): {}", status, body));
    }

    let parsed: serde_json::Value = serde_json::from_str(&body).unwrap_or_default();
    if parsed.get("success").and_then(|s| s.as_bool()) == Some(false) {
        let msg = parsed.get("message").and_then(|m| m.as_str()).unwrap_or("Failed to submit issue report.");
        return Err(msg.to_string());
    }

    Ok(body)
}


#[tauri::command]
pub fn get_local_ips() -> Vec<String> {
    let mut ips = vec!["127.0.0.1".to_string()];
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                let ip = addr.ip().to_string();
                if ip != "127.0.0.1" && !ips.contains(&ip) {
                    ips.push(ip);
                }
            }
        }
    }
    ips
}

#[tauri::command]
pub fn restart_app(app: tauri::AppHandle) {
    app.restart();
}


