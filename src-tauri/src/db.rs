#[cfg(not(debug_assertions))]
use keyring::Entry;
use tauri::Manager;
use crate::state::ProviderHealthState;

#[tauri::command]
pub fn set_credential(app: tauri::AppHandle, service: &str, secret: &str) -> Result<(), String> {
    if let Some(health_state) = app.try_state::<ProviderHealthState>() {
        let s = service.to_string();
        let cooldowns_arc = health_state.provider_cooldowns.clone();
        let statuses_arc = health_state.live_statuses.clone();
        tauri::async_runtime::spawn(async move {
            let mut cooldowns = cooldowns_arc.write().await;
            cooldowns.remove(&s);
            let mut statuses = statuses_arc.write().await;
            statuses.remove(&s);
        });
    }
    #[cfg(debug_assertions)]
    {
        let key = format!("{}_KEY", service.to_uppercase());
        let current_dir = std::env::current_dir().unwrap_or_default();
        let env_path = if current_dir.join(".env").exists() {
            current_dir.join(".env")
        } else if current_dir.join("src-tauri").join(".env").exists() {
            current_dir.join("src-tauri").join(".env")
        } else {
            current_dir.join(".env")
        };
        
        let contents = if env_path.exists() {
            std::fs::read_to_string(&env_path).unwrap_or_default()
        } else {
            String::new()
        };
        
        let mut updated = false;
        let mut new_contents = String::new();
        for line in contents.lines() {
            if line.starts_with(&format!("{}=", key)) {
                new_contents.push_str(&format!("{}={}\n", key, secret));
                updated = true;
            } else {
                new_contents.push_str(line);
                new_contents.push('\n');
            }
        }
        
        if !updated {
            new_contents.push_str(&format!("{}={}\n", key, secret));
        }
        
        std::fs::write(&env_path, new_contents).map_err(|e| e.to_string())?;
        std::env::set_var(key, secret);
        return Ok(());
    }

    #[cfg(not(debug_assertions))]
    {
        let entry = Entry::new("frugallm-app", service).map_err(|e| e.to_string())?;
        entry.set_password(secret).map_err(|e| e.to_string())?;
        return Ok(());
    }
}

#[tauri::command]
pub fn get_credential(service: &str) -> Result<String, String> {
    #[cfg(debug_assertions)]
    {
        let key = format!("{}_KEY", service.to_uppercase());
        if let Ok(val) = std::env::var(&key) {
            if !val.trim().is_empty() {
                return Ok(val);
            }
        }

        let current_dir = std::env::current_dir().unwrap_or_default();
        let env_candidates = [
            current_dir.join(".env"),
            current_dir.join("src-tauri").join(".env"),
            current_dir.parent().unwrap_or(&std::path::PathBuf::new()).join(".env"),
            current_dir.parent().unwrap_or(&std::path::PathBuf::new()).join("src-tauri").join(".env"),
        ];

        for env_path in &env_candidates {
            if env_path.exists() {
                if let Ok(contents) = std::fs::read_to_string(env_path) {
                    for line in contents.lines() {
                        let prefix = format!("{}=", key);
                        if let Some(stripped) = line.strip_prefix(&prefix) {
                            let val = stripped.trim().to_string();
                            if !val.is_empty() {
                                std::env::set_var(&key, &val);
                                return Ok(val);
                            }
                        }
                    }
                }
            }
        }

        return Err(format!("Credential for service '{}' not found", service));
    }

    #[cfg(not(debug_assertions))]
    {
        let entry = Entry::new("frugallm-app", service).map_err(|e| e.to_string())?;
        return entry.get_password().map_err(|e| e.to_string());
    }
}

#[tauri::command]
pub fn delete_credential(service: &str) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        let key = format!("{}_KEY", service.to_uppercase());
        std::env::remove_var(&key);

        let current_dir = std::env::current_dir().unwrap_or_default();
        let env_candidates = [
            current_dir.join(".env"),
            current_dir.join("src-tauri").join(".env"),
            current_dir.parent().unwrap_or(&std::path::PathBuf::new()).join(".env"),
            current_dir.parent().unwrap_or(&std::path::PathBuf::new()).join("src-tauri").join(".env"),
        ];

        for env_path in &env_candidates {
            if env_path.exists() {
                if let Ok(contents) = std::fs::read_to_string(env_path) {
                    let mut new_contents = String::new();
                    let prefix = format!("{}=", key);
                    for line in contents.lines() {
                        if !line.starts_with(&prefix) {
                            new_contents.push_str(line);
                            new_contents.push('\n');
                        }
                    }
                    let _ = std::fs::write(env_path, new_contents);
                }
            }
        }
        return Ok(());
    }

    #[cfg(not(debug_assertions))]
    {
        if let Ok(entry) = Entry::new("frugallm-app", service) {
            let _ = entry.delete_credential();
        }
        return Ok(());
    }
}

#[tauri::command]
pub fn wipe_credentials() -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        let current_dir = std::env::current_dir().unwrap_or_default();
        let env_candidates = [
            current_dir.join(".env"),
            current_dir.join("src-tauri").join(".env"),
        ];
        for env_path in &env_candidates {
            if env_path.exists() {
                let _ = std::fs::remove_file(env_path);
            }
        }
        // Also remove from current environment so it doesn't linger
        std::env::remove_var("OPENROUTER_KEY");
        std::env::remove_var("GOOGLE_KEY");
        std::env::remove_var("OLLAMA_KEY");
        return Ok(());
    }

    #[cfg(not(debug_assertions))]
    {
        for svc in &["openrouter", "google"] {
            if let Ok(entry) = Entry::new("frugallm-app", svc) {
                let _ = entry.delete_credential();
            }
        }
        return Ok(());
    }
}

