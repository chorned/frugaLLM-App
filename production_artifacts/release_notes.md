# FrugaLLM v0.0.14 Release Notes

### 🚀 Features
- **Native Windows OpenCode & Hermes Installers:** Integrated automated PowerShell provisioning workflows directly into Terminal Runner. OpenCode automatically downloads and extracts official Windows binaries (`opencode-windows-x64.zip`) into `$HOME\.opencode\bin` with npm fallback; Hermes invokes Nous Research's official `install.ps1 -SkipSetup`.
- **Unified Cross-Platform System File Opener:** Replaced brittle shell command invocations with native `tauri_plugin_opener` integration for opening application logs and soul configuration across Windows (`ShellExecuteW` with `notepad.exe` fallback), macOS (`open -t`), and Linux (`xdg-open`).
- **Auto-Provisioned Hermes Soul Template:** Clicking "EDIT SOUL.MD" automatically provisions the complete default Hermes system prompt and scratchpad instructions on disk if not yet initialized.

### 🐛 Fixes
- **Startup Dynamic Routing Roster & Silent Daemon Failure:** Populated `DynamicRosterState.fallback_chain` immediately in `.setup()` and introduced on-demand self-healing in `/v1/chat/completions` and periodic health check loops, eliminating `HTTP 500: All upstream providers failed:` on cold boot or headless (`--silent`) execution.
- **macOS False-Positive Ollama Detection:** Removed bare `/Applications/Ollama.app` bundle directory fallback checks so orphaned or incomplete app folders do not suppress installation or cause `No such file or directory` during daemon startup.
- **Windows Ollama Seamless Headless Provisioning:** Injected the `%LOCALAPPDATA%\Ollama\upgraded` marker prior to running `OllamaSetup.exe` to suppress the onboarding GUI window, isolated installer process execution via PowerShell `Start-Process -PassThru` to prevent subprocess hangs, and streamed real-time stdout/stderr into the terminal view.
- **Terminal Runner Silent Timeouts:** Guarded all PTY process spawns with resilient error boundaries, surfacing actionable ANSI diagnostic errors immediately in the terminal view rather than hanging when dependencies or system executables are missing.

### 🔧 Under the Hood
- **Persistent Windows PATH Synchronization:** Synchronized `%LOCALAPPDATA%\hermes\bin`, `%LOCALAPPDATA%\Programs\opencode`, `%LOCALAPPDATA%\Programs\Ollama`, and `$HOME\.opencode\bin` into user-level Windows registry PATH settings when toggling global CLI commands.
- **Robust WebView ONNX Caching:** Guarded browser `CacheStorage` checks in `onnxGateway.ts` to support restricted WebKitGTK and WebView2 contexts safely without breaking local ONNX session initialization.
- **Modular Architectural Boundaries (CHO-118):** Refactored `src-tauri/src/main.rs` to maintain 226 lines (< 250 lines) while supporting dynamic startup hooks.
- **Automated macOS Code Signing & Apple Notarization:** Configured Developer ID Application certificate signing with Hardened Runtime (`Entitlements.plist`) and App Store Connect API notarization pipeline via GitHub Actions for seamless Gatekeeper compliance.
- **Cross-Platform Verification & Test Pyramid:** All 67 Rust unit tests and 232 Vitest tests passing green.

### 📦 Downloads & Installation

| Platform | Variant / Architecture | Direct Download |
| :--- | :--- | :--- |
| **macOS** | Universal (Apple Silicon & Intel) | [frugallm-app_0.0.14_universal.dmg](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.14/frugallm-app_0.0.14_universal.dmg) |
| **Windows** | Standard Installer (`.exe`) | [frugallm-app_0.0.14_x64-setup.exe](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.14/frugallm-app_0.0.14_x64-setup.exe) |
| **Ubuntu** | Debian Installer (`.deb`) | [frugallm-app_0.0.14_amd64.deb](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.14/frugallm-app_0.0.14_amd64.deb) |
| **SteamOS** | Universal Portable (`.AppImage`) | [frugallm-app_0.0.14_amd64.AppImage](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.14/frugallm-app_0.0.14_amd64.AppImage) |
