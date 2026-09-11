use crate::state::*;
use crate::telemetry::HardwareProfile;
use tauri::Manager;

pub async fn get_hardware_profile() -> Result<HardwareProfile, String> {
    let is_unified: bool;
    let mut dedicated_vram: u64 = 0;
    let mut system_ram: u64 = 0;
    let os_architecture: String;

    #[cfg(target_os = "macos")]
    {
        let is_arm = std::env::consts::ARCH == "aarch64";
        os_architecture = format!("macos-{}", std::env::consts::ARCH);

        // Query total system RAM via sysctl hw.memsize
        if let Ok(output) = tokio::process::Command::new("sysctl")
            .arg("-n")
            .arg("hw.memsize")
            .output()
            .await
        {
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
            if let Ok(output) = tokio::process::Command::new("system_profiler")
                .arg("SPDisplaysDataType")
                .output()
                .await
            {
                if output.status.success() {
                    if let Ok(prof_str) = String::from_utf8(output.stdout) {
                        let mut max_vram_mb: u64 = 0;
                        for line in prof_str.lines() {
                            if line.contains("VRAM (Total):")
                                || line.contains("VRAM (Dynamic, Max):")
                            {
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

    #[cfg(not(target_os = "macos"))]
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

pub fn format_log_entry(level: &str, tag: &str, message: &str) -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("[{}] [{}] [{}] {}\n", now, level, tag, message)
}

pub fn append_log_entry_to_path(
    path: &std::path::Path,
    level: &str,
    tag: &str,
    message: &str,
) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)?;
        }
    }
    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?;
    let entry = format_log_entry(level, tag, message);
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

#[tauri::command]
pub fn open_app_logs(app: tauri::AppHandle) -> Result<(), String> {
    let log_path = get_app_log_file_path(&app)?;
    if !log_path.exists() {
        let _ = append_log_entry_to_path(&log_path, "INFO", "INIT", "FrugaLLM log initialized");
    }
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(&log_path).spawn();
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("cmd")
        .args(["/C", "start", "", &log_path.to_string_lossy()])
        .spawn();
    #[cfg(target_os = "linux")]
    let _ = std::process::Command::new("xdg-open")
        .arg(&log_path)
        .spawn();
    Ok(())
}

pub fn sanitize_diagnostic_logs(raw_logs: &str) -> String {
    let key_regex = regex::Regex::new(
        r"(sk-[a-zA-Z0-9_\-]{20,}|AIza[a-zA-Z0-9_\-]{16,}|Bearer\s+[a-zA-Z0-9_\.\-]+)",
    )
    .unwrap();
    key_regex
        .replace_all(raw_logs, "[REDACTED_API_KEY]")
        .to_string()
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
        let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        // Grab the last 400 lines to keep payload size healthy
        content
            .lines()
            .rev()
            .take(400)
            .collect::<Vec<&str>>()
            .into_iter()
            .rev()
            .collect::<Vec<&str>>()
            .join("\n")
    } else {
        "No log file found on disk.".to_string()
    };

    let sanitized_logs = sanitize_diagnostic_logs(&raw_logs);

    Ok(DiagnosticPayload {
        app_version: app.package_info().version.to_string(),
        os_info: format!("{} {}", std::env::consts::OS, std::env::consts::ARCH),
        logs: sanitized_logs,
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
        let msg = parsed
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("Failed to submit issue report.");
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
