# FrugaLLM v0.1.1 Release Notes

### 🚀 Features
- **Modularized Onboarding Launchpad UI**: Refactored Onboarding Step 6 into a dedicated, test-isolated component featuring dynamic agent status badges, companion action CTAs, and streamlined clipboard-based terminal handoff.
- **Zero-Spillover Local Proxy Core**: Local-first OpenAI-compatible proxy running on port `61721` with dynamic schema normalization, streaming SSE dispatch, and low-latency request handling.
- **Global Routing Pool & Model Topology**: Interactive visual topology canvas connecting agents (Hermes, OpenCode) with local (Ollama) and cloud providers (Google AI Studio, OpenRouter).
- **Hardware Memory Visualizers & Telemetry**: Real-time CPU, RAM, and NVIDIA GPU VRAM monitoring to prevent out-of-memory states and optimize model routing.
- **Bidirectional Canvas Edge Highlighting**: Real-time visual pulse animations indicating request and response data flow phases across active nodes.

### 🐛 Fixes
- **Cross-Platform Hermes & OpenCode Companion Setup**: Resolved Windows PATH resolution, ConPTY stream non-blocking read handling, and companion CLI detection across Windows, macOS, and Linux (#66).
- **Drawer Lifecycle & Port Routing**: Eliminated UI lockout states during port contention and resolved drawer unmount lifecycle race conditions.
- **ConPTY Windows Buffer Stability**: Resolved pseudo-terminal buffer synchronization and exit handle mismatches in Windows terminal environments.
- **Axum IPC Non-Blocking Handlers**: Ensured asynchronous proxy endpoints never block the Tokio runtime during heavy streaming or connection drops.
- **PTY Concurrency Mutex & Lifecycle**: Stabilized terminal process tree shutdown, preventing orphaned child processes and deadlocks.
- **Ollama Empty Model Discovery**: Gracefully handles cold-start and pre-installed Ollama instances with manifest validation.

### 🔧 Under the Hood
- **Vite 8 & Modern Frontend Tooling**: Upgraded to Vite 8.3.0 and `@vitejs/plugin-react` 6.1.1, alongside Vitest 5 test runner synchronization (#54, #68).
- **Comprehensive Dependency Modernization**: Updated core dependencies across backend and frontend stacks (`tauri` 2.11.6, `dirs` 7.0, `windows-sys` 0.61.2, `@huggingface/transformers` 4.3.0, `framer-motion` 13.4.1, `lucide-react` 1.47.0).
- **Hardened GitHub Actions CI**: Upgraded GitHub action runner steps to pinned immutable SHAs and enhanced cross-platform test matrix resilience.
- **100% Bare-Metal UAT Suite**: Automated end-to-end hardware acceptance test suite covering boot, onboarding, provider probing, and proxy routing.
- **Apple Notarization & Cross-Platform Matrix**: Hardened production release pipelines with macOS code signing/notarization, Windows NSIS installers, and Linux AppImage/deb packaging.
- **Pluggable Credential Store & Keyring Security**: Direct OS vault integration via macOS Keychain, Windows Credential Manager, and Linux Secret Service.

### 📦 Downloads & Installation

| Platform | Variant / Architecture | Direct Download |
| :--- | :--- | :--- |
| **macOS** | Universal (Apple Silicon & Intel) | [frugallm-app_0.1.1_universal.dmg](https://github.com/chorned/frugaLLM-App/releases/download/v0.1.1/frugallm-app_0.1.1_universal.dmg) |
| **Windows** | Standard Installer (`.exe`) | [frugallm-app_0.1.1_x64-setup.exe](https://github.com/chorned/frugaLLM-App/releases/download/v0.1.1/frugallm-app_0.1.1_x64-setup.exe) |
| **Ubuntu** | Debian Installer (`.deb`) | [frugallm-app_0.1.1_amd64.deb](https://github.com/chorned/frugaLLM-App/releases/download/v0.1.1/frugallm-app_0.1.1_amd64.deb) |
| **SteamOS** | Universal Portable (`.AppImage`) | [frugallm-app_0.1.1_amd64.AppImage](https://github.com/chorned/frugaLLM-App/releases/download/v0.1.1/frugallm-app_0.1.1_amd64.AppImage) |
