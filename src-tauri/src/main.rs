// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;

#[derive(serde::Serialize)]
struct LaunchOptions {
    openrouter_key: Option<String>,
    local_llm_ip: Option<String>,
}

#[tauri::command]
fn get_launch_options() -> LaunchOptions {
    let args: Vec<String> = env::args().collect();
    let mut openrouter_key = None;
    let mut local_llm_ip = None;

    let mut i = 1;
    while i < args.len() {
        if args[i] == "--openrouter-key" && i + 1 < args.len() {
            openrouter_key = Some(args[i + 1].clone());
            i += 2;
        } else if args[i] == "--local-llm" && i + 1 < args.len() {
            local_llm_ip = Some(args[i + 1].clone());
            i += 2;
        } else {
            i += 1;
        }
    }
    
    LaunchOptions {
        openrouter_key,
        local_llm_ip,
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![get_launch_options])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
