# FrugaLLM v0.1.2 Release Notes

### 🚀 Features
- **Dynamic Routing & Stream Failover Hardening**: Enhanced OpenAI-compatible proxy streaming resilience on port `61721` with structured thought signature handling and model-level quota classification.
- **Bare-Metal UAT Suite & Test Pyramid Expansion**: Validated 100% green test suite across 122 Rust unit/integration tests, 370 frontend unit tests, and 29 automated bare-metal Playwright UAT phases.

### 🐛 Fixes
- **Windows Agent Installation & Pack File Teardown**: Fixed terminal runner deadlocks during companion installer scripts by detecting functional existing binaries, auto-purging corrupt non-git install directories, and utilizing PowerShell `-LiteralPath` deletion with quote escaping for read-only Git pack files on Windows (#82).
- **Global Routing Candidate Discovery & Proxy Inference**: Eliminated premature model deprovisioning in setup phases to ensure Ollama candidates (`gemma4:e2b`) are preserved for downstream routing and inference (#82).
- **Proxy Server Mock IPC Routing Parity**: Added missing IPC dispatch routes in `src-tauri/src/proxy/server.rs` for `resize_pty`, `set_global_cli_commands`, `get_global_cli_commands_status`, `start_hermes_service`, and `stop_hermes_service` (#82).
- **Gemini 3 Thought Signature & Tool Token Sanitization**: Resolved HTTP 400 errors from unhandled thought signatures during Gemini 3 streaming and sanitized raw internal tool tokens from client responses (#74).
- **Windows Ollama Installer Resilience**: Hardened headless installer execution, process exit timeouts, and elevated directory cleanup routines (#75).

### 🔧 Under the Hood
- **Tauri Ecosystem & Crate Upgrades**: Bumped `@tauri-apps/api` (~2.12.0), `@tauri-apps/cli` (~2.12.0), and official Tauri plugins (`autostart`, `clipboard-manager`, `http`, `opener`, `shell`, `store`), with synchronized Cargo crate updates (#78, #79).
- **Frontend Dependency Modernization**: Updated `framer-motion` to 13.4.6, `lucide-react` to 1.49.0, `undici` to 6.29.0, and `@vitest/coverage-v8` to 5.0.2 (#76, #77, #79).
- **CI Actions & Security Upgrades**: Updated `dtolnay/rust-toolchain`, `actions/checkout`, and `github/codeql-action` to latest releases (#80, #81).
- **Inventory Synchronization**: Refreshed third-party software license inventory and dependency parity across Cargo and npm lockfiles.

### 📦 Downloads & Installation

| Platform | Variant / Architecture | Direct Download |
| :--- | :--- | :--- |
| **macOS** | Universal (Apple Silicon & Intel) | [frugallm-app_0.1.2_universal.dmg](https://github.com/chorned/frugaLLM-App/releases/download/v0.1.2/frugallm-app_0.1.2_universal.dmg) |
| **Windows** | Standard Installer (`.exe`) | [frugallm-app_0.1.2_x64-setup.exe](https://github.com/chorned/frugaLLM-App/releases/download/v0.1.2/frugallm-app_0.1.2_x64-setup.exe) |
| **Ubuntu** | Debian Installer (`.deb`) | [frugallm-app_0.1.2_amd64.deb](https://github.com/chorned/frugaLLM-App/releases/download/v0.1.2/frugallm-app_0.1.2_amd64.deb) |
| **SteamOS** | Universal Portable (`.AppImage`) | [frugallm-app_0.1.2_amd64.AppImage](https://github.com/chorned/frugaLLM-App/releases/download/v0.1.2/frugallm-app_0.1.2_amd64.AppImage) |
