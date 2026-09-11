# FrugaLLM v0.0.14 Release Notes

### 🚀 Features
- **Native Windows OpenCode & Hermes Installers:** Integrated automated PowerShell provisioning workflows directly into Terminal Runner. OpenCode automatically downloads and extracts official Windows binaries (`opencode-windows-x64.zip`) into `$HOME\.opencode\bin` with npm fallback; Hermes invokes Nous Research's official `install.ps1 -SkipSetup`.
- **Unified Cross-Platform System File Opener:** Replaced brittle shell command invocations with native `tauri_plugin_opener` integration for opening application logs and soul configuration across Windows (`ShellExecuteW` with `notepad.exe` fallback), macOS (`open -t`), and Linux (`xdg-open`).
- **Auto-Provisioned Hermes Soul Template:** Clicking "EDIT SOUL.MD" automatically provisions the complete default Hermes system prompt and scratchpad instructions on disk if not yet initialized.

### 🐛 Fixes
- **Windows Ollama Installation OS Error 32:** Resolved file sharing lock violation during Ollama installation on Windows by releasing file write handles prior to process spawn, switching to isolated timestamped temp installers, and applying silent unattended flags (`/VERYSILENT /NORESTART /CLOSEAPPLICATIONS /SUPPRESSMSGBOXES`).
- **Terminal Runner Silent Timeouts:** Guarded all PTY process spawns with resilient error boundaries, surfacing actionable ANSI diagnostic errors immediately in the terminal view rather than hanging when dependencies or system executables are missing.

### 🔧 Under the Hood
- **Persistent Windows PATH Synchronization:** Synchronized `%LOCALAPPDATA%\hermes\bin`, `%LOCALAPPDATA%\Programs\opencode`, `%LOCALAPPDATA%\Programs\Ollama`, and `$HOME\.opencode\bin` into user-level Windows registry PATH settings when toggling global CLI commands.
- **Robust WebView ONNX Caching:** Guarded browser `CacheStorage` checks in `onnxGateway.ts` to support restricted WebKitGTK and WebView2 contexts safely without breaking local ONNX session initialization.
- **Cross-Platform Verification & Test Pyramid:** Added dedicated Windows native execution test suite (`terminalViewWindows.test.tsx`) and backend unit tests for installer handle safety and soul template generation. All 62 Rust unit tests and 232 Vitest tests passing green.

### 📦 Downloads & Installation

| Platform | Variant / Architecture | Direct Download |
| :--- | :--- | :--- |
| **macOS** | Universal (Apple Silicon & Intel) | [frugallm-app_0.0.14_universal.dmg](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.14/frugallm-app_0.0.14_universal.dmg) |
| **Windows** | Standard Installer (`.exe`) | [frugallm-app_0.0.14_x64-setup.exe](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.14/frugallm-app_0.0.14_x64-setup.exe) |
| **Ubuntu** | Debian Installer (`.deb`) | [frugallm-app_0.0.14_amd64.deb](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.14/frugallm-app_0.0.14_amd64.deb) |
| **SteamOS** | Universal Portable (`.AppImage`) | [frugallm-app_0.0.14_amd64.AppImage](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.14/frugallm-app_0.0.14_amd64.AppImage) |
