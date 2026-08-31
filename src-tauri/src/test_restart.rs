pub fn restart(app: &tauri::AppHandle) {
    app.restart();
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_restart_signature_presence() {
        // Validates that the restart helper exists with the expected function pointer signature
        let _fn_ptr: fn(&tauri::AppHandle) = super::restart;
    }
}

