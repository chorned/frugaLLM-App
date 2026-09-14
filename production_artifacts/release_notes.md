# FrugaLLM v0.0.15 Release Notes

### 🚀 Features
- **Full Windows Gemma 4 Zero-Spillover Parity:** Complete native Windows integration for local Gemma 4 model deployment with automatic VRAM fitting, discrete GPU telemetry, and 60-minute VRAM memory locking.
- **Deep Clean Agent Uninstallation & Wiping:** Introduced a deep `--wipe` routine for uninstallation and lifecycle management, safely stripping local models, roaming application state, registry entries, and orphaned binaries for Ollama, OpenCode, and Hermes.
- **Real-Time Download Progress & Diagnostics:** Added real-time download streaming with instantaneous transfer rate calculation, remaining ETA, and dedicated daemon log redirection (`server.log`) to prevent console bleed.
- **Automated Windows Lifecycle Management:** Comprehensive handling for background daemons, automated process tree termination, and robust PowerShell runner routines across all supported agents.

### 🐛 Fixes
- **Silent Process Tree Termination:** Silenced `taskkill` stderr output (`Stdio::null()`) during shutdown and wipe routines to prevent noisy process cleanup errors when terminating child processes.
- **ConPTY Non-Blocking Streams:** Hardened pseudo-terminal execution on Windows to prevent EOF read thread blocking, ensuring snappy terminal launch and teardown.
- **Ollama Daemon Startup Stability:** Increased startup timeout to 120 seconds with robust process table polling and suppressed background log noise.
- **Dual OpenAI Base URL Configuration:** Enhanced agent configuration to provide both `OPENAI_BASE_URL` and `OPENAI_API_BASE` environment variables for full compatibility with older and newer agent CLI frameworks.
- **Cross-Platform Compiler Warning Cleanups:** Resolved non-Windows variable warnings and ensured zero compiler warnings across all platforms.

### 🔧 Under the Hood
- **Windows Engineering Skill & Architecture Manifesto:** Added comprehensive documentation (`.agents/ARCHITECTURE.md` and `windows-development` skill) enforcing strict isolation of OS-specific logic behind conditional compilation flags (`#[cfg(target_os = "windows")]`).
- **Expanded Test Coverage:** Added 5 new Rust unit tests (now 78 passing backend tests) and 7 new Vitest unit tests (now 239 passing frontend tests) verifying cross-platform terminal, process lifecycle, and memory allocation edge cases.
- **Automated Multi-Platform Release Pipeline:** Configured GitHub Actions matrix for macOS (Universal Apple Silicon & Intel), Windows (x64 setup installer), Ubuntu (Debian `.deb`), and SteamOS (`.AppImage`).

### 📦 Downloads & Installation

| Platform | Variant / Architecture | Direct Download |
| :--- | :--- | :--- |
| **macOS** | Universal (Apple Silicon & Intel) | [frugallm-app_0.0.15_universal.dmg](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.15/frugallm-app_0.0.15_universal.dmg) |
| **Windows** | Standard Installer (`.exe`) | [frugallm-app_0.0.15_x64-setup.exe](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.15/frugallm-app_0.0.15_x64-setup.exe) |
| **Ubuntu** | Debian Installer (`.deb`) | [frugallm-app_0.0.15_amd64.deb](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.15/frugallm-app_0.0.15_amd64.deb) |
| **SteamOS** | Universal Portable (`.AppImage`) | [frugallm-app_0.0.15_amd64.AppImage](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.15/frugallm-app_0.0.15_amd64.AppImage) |
