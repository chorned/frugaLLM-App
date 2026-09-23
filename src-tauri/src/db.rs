use keyring::Entry;
use tauri::Manager;
use crate::state::ProviderHealthState;
use std::sync::{Arc, RwLock};
use lazy_static::lazy_static;

pub trait CredentialStore: Send + Sync {
    fn get(&self, service: &str) -> Result<String, String>;
    fn set(&self, service: &str, secret: &str) -> Result<(), String>;
    fn delete(&self, service: &str) -> Result<(), String>;
    fn wipe(&self) -> Result<(), String> {
        for svc in &["openrouter", "google", "ollama"] {
            let _ = self.delete(svc);
        }
        Ok(())
    }
}

pub struct KeyringCredentialStore;

impl CredentialStore for KeyringCredentialStore {
    fn get(&self, service: &str) -> Result<String, String> {
        let key = format!("{}_KEY", service.to_uppercase());
        if let Ok(val) = std::env::var(&key) {
            let trimmed = val.trim();
            if !trimmed.is_empty() {
                return Ok(trimmed.to_string());
            }
        }
        let alt_key = format!("{}_API_KEY", service.to_uppercase());
        if let Ok(val) = std::env::var(&alt_key) {
            let trimmed = val.trim();
            if !trimmed.is_empty() {
                return Ok(trimmed.to_string());
            }
        }

        let entry = Entry::new("frugallm-app", service).map_err(|e| e.to_string())?;
        entry.get_password().map_err(|e| e.to_string())
    }

    fn set(&self, service: &str, secret: &str) -> Result<(), String> {
        let entry = Entry::new("frugallm-app", service).map_err(|e| e.to_string())?;
        entry.set_password(secret).map_err(|e| e.to_string())?;
        let key = format!("{}_KEY", service.to_uppercase());
        std::env::set_var(key, secret);
        Ok(())
    }

    fn delete(&self, service: &str) -> Result<(), String> {
        let key = format!("{}_KEY", service.to_uppercase());
        std::env::remove_var(&key);
        let alt_key = format!("{}_API_KEY", service.to_uppercase());
        std::env::remove_var(&alt_key);

        if let Ok(entry) = Entry::new("frugallm-app", service) {
            let _ = entry.delete_credential();
        }
        Ok(())
    }
}

#[derive(Default)]
pub struct InMemoryCredentialStore {
    store: RwLock<std::collections::HashMap<String, String>>,
}

impl InMemoryCredentialStore {
    pub fn new() -> Self {
        Self::default()
    }
}

impl CredentialStore for InMemoryCredentialStore {
    fn get(&self, service: &str) -> Result<String, String> {
        let map = self.store.read().map_err(|e| e.to_string())?;
        map.get(&service.to_lowercase())
            .cloned()
            .ok_or_else(|| format!("Credential for service '{}' not found", service))
    }

    fn set(&self, service: &str, secret: &str) -> Result<(), String> {
        let mut map = self.store.write().map_err(|e| e.to_string())?;
        map.insert(service.to_lowercase(), secret.to_string());
        Ok(())
    }

    fn delete(&self, service: &str) -> Result<(), String> {
        let mut map = self.store.write().map_err(|e| e.to_string())?;
        map.remove(&service.to_lowercase());
        Ok(())
    }

    fn wipe(&self) -> Result<(), String> {
        let mut map = self.store.write().map_err(|e| e.to_string())?;
        map.clear();
        Ok(())
    }
}

pub fn default_credential_store() -> Arc<dyn CredentialStore> {
    #[cfg(test)]
    {
        Arc::new(InMemoryCredentialStore::new())
    }

    #[cfg(not(test))]
    {
        if std::env::var("FRUGALLM_IN_MEMORY_CREDENTIALS").map(|v| v == "1" || v == "true").unwrap_or(false)
            || std::env::args().any(|a| a == "--in-memory-credentials" || a == "--uat-runner")
        {
            Arc::new(InMemoryCredentialStore::new())
        } else {
            Arc::new(KeyringCredentialStore)
        }
    }
}

lazy_static! {
    static ref ACTIVE_STORE: RwLock<Arc<dyn CredentialStore>> = RwLock::new(default_credential_store());
}

pub fn set_credential_store(store: Arc<dyn CredentialStore>) {
    if let Ok(mut guard) = ACTIVE_STORE.write() {
        *guard = store;
    }
}

pub fn use_in_memory_credential_store() -> Arc<InMemoryCredentialStore> {
    let store = Arc::new(InMemoryCredentialStore::new());
    set_credential_store(store.clone());
    store
}

pub fn active_credential_store() -> Arc<dyn CredentialStore> {
    ACTIVE_STORE.read().map(|g| g.clone()).unwrap_or_else(|_| default_credential_store())
}

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
    active_credential_store().set(service, secret)
}

#[tauri::command]
pub fn get_credential(service: &str) -> Result<String, String> {
    active_credential_store().get(service)
}

#[tauri::command]
pub fn delete_credential(service: &str) -> Result<(), String> {
    let key = format!("{}_KEY", service.to_uppercase());
    std::env::remove_var(&key);
    let alt_key = format!("{}_API_KEY", service.to_uppercase());
    std::env::remove_var(&alt_key);
    active_credential_store().delete(service)
}

#[tauri::command]
pub fn wipe_credentials() -> Result<(), String> {
    for svc in &["openrouter", "google", "ollama"] {
        let key = format!("{}_KEY", svc.to_uppercase());
        std::env::remove_var(&key);
        let alt_key = format!("{}_API_KEY", svc.to_uppercase());
        std::env::remove_var(&alt_key);
    }
    active_credential_store().wipe()
}
