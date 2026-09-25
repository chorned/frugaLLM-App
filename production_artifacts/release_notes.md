# FrugaLLM v0.1.0 Release Notes

### 🚀 Features
- **Zero-Spillover Local Proxy Core**: Local-first OpenAI-compatible proxy running on port `61721` with dynamic schema normalization, streaming SSE dispatch, and low-latency request handling.
- **Global Routing Pool & Model Topology**: Interactive visual topology canvas connecting agents (Hermes, OpenCode) with local (Ollama) and cloud providers (Google AI Studio, OpenRouter).
- **Hardware Memory Visualizers & Telemetry**: Real-time CPU, RAM, and NVIDIA GPU VRAM monitoring to prevent out-of-memory states and optimize model routing.
- **Onboarding Launchpad & Starter Missions**: Interactive guided setup with companion launch cards and pre-configured starter mission prompts for OpenCode and Hermes Agent.
- **Bidirectional Canvas Edge Highlighting**: Real-time visual pulse animations indicating request and response data flow phases across active nodes.

### 🐛 Fixes
- **ConPTY Windows Buffer Stability**: Resolved pseudo-terminal buffer synchronization and exit handle mismatches in Windows terminal environments.
- **Port Conflict Drawer Lockout**: Eliminated UI lockout states during port contention and added non-blocking health recovery indicators.
- **Axum IPC Non-Blocking Handlers**: Ensured asynchronous proxy endpoints never block the Tokio runtime during heavy streaming or connection drops.
- **PTY Concurrency Mutex & Lifecycle**: Stabilized terminal process tree shutdown, preventing orphaned child processes and deadlocks.
- **Ollama Empty Model Discovery**: Gracefully handles cold-start and pre-installed Ollama instances with manifest validation.

### 🔧 Under the Hood
- **100% Bare-Metal UAT Suite**: Automated end-to-end hardware acceptance test suite covering boot, onboarding, provider probing, and proxy routing.
- **Apple Notarization & Cross-Platform Matrix**: Hardened production release pipelines with macOS code signing/notarization, Windows NSIS installers, and Linux AppImage/deb packaging.
- **Pluggable Credential Store & Keyring Security**: Direct OS vault integration via macOS Keychain, Windows Credential Manager, and Linux Secret Service.
- **Modular Systems Architecture**: Strict separation of concerns between Tauri IPC command layers, Axum proxy services, and reactive React state machines.

### 📦 Downloads & Installation

| Platform | Variant / Architecture | Direct Download |
| :--- | :--- | :--- |
| **macOS** | Universal (Apple Silicon & Intel) | [frugallm-app_0.1.0_universal.dmg](https://github.com/chorned/frugaLLM-App/releases/download/v0.1.0/frugallm-app_0.1.0_universal.dmg) |
| **Windows** | Standard Installer (.exe) | [frugallm-app_0.1.0_x64-setup.exe](https://github.com/chorned/frugaLLM-App/releases/download/v0.1.0/frugallm-app_0.1.0_x64-setup.exe) |
| **Ubuntu** | Debian Installer (.deb) | [frugallm-app_0.1.0_amd64.deb](https://github.com/chorned/frugaLLM-App/releases/download/v0.1.0/frugallm-app_0.1.0_amd64.deb) |
| **SteamOS** | Universal Portable (.AppImage) | [frugallm-app_0.1.0_amd64.AppImage](https://github.com/chorned/frugaLLM-App/releases/download/v0.1.0/frugallm-app_0.1.0_amd64.AppImage) |
