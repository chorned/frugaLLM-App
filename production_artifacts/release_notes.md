# FrugaLLM v0.0.12 Release Notes

### 🚀 Features
- **In-App Diagnostic Issue Reporter:** Integrated an end-to-end feedback and bug reporting modal into node configuration. Automatically bundles system architecture, VRAM metrics, and sanitized proxy logs while strictly scrubbing API keys, tokens, and credentials before dispatch.
- **Dynamic Next-Call Provider Health Status:** Upgraded visual status indicators to reflect the health of the *next upcoming fallback model*. Providers stay Green (`200 OK`) as long as an alternative candidate in the pool is viable, switching to Yellow (`429`/`500` temporary exhaustion) or Red (`404`/`403` fatal lockout) based on true backend routability.
- **Extended Google Gemini Model Registry:** Added modern active Gemini 3.5 & 3.8 candidates (`gemini-3.5-flash`, `gemini-3.8-flash`, etc.) and pruned deprecated endpoints to prevent false 404 lockout cycles on newly provisioned API keys.

### 🐛 Fixes
- **Topology Canvas Node Padding & Geometry:** Symmetrized the vertical and horizontal layout of all peripheral and core canvas nodes. Eliminated dead container bottom space and standardized uniform 10px spacing between card borders and inner telemetry rows.
- **Exhaustive `--wipe` Clean-Slate Cleanup:** Resolved an issue where `--wipe` failed to purge the Tool Enforcing Gateway marker and local model caches. `--wipe` now comprehensively clears `tool_gateway_installed`, local `models/`, `frugal_config.json`, OpenCode settings, and client-side ONNX browser caches.
- **Native OpenCode & Agent Uninstallation:** Replaced brittle shell subshell calls in uninstallation handlers with dedicated Rust IPC commands (`uninstall_opencode`, `uninstall_hermes`), fixing silent failures in the node configuration uninstallation CTA.

### 🔧 Under the Hood
- **Frontend & Backend Architectural Deconstruction:** Modularized monolithic entry points (`App.tsx` and `src-tauri/src/main.rs`) into focused domain components (`TopologyCanvas`, `NodeConfigPanel`, `TerminalView`, `Header`, `Footer`), custom React hooks, proxy service modules, and typed Tauri IPC clients. `main.rs` is strictly capped at under 250 lines.
- **High-Fidelity Automated Test Suites:** Validated zero regressions across the codebase with 51 Rust unit tests and 201 frontend Vitest unit tests across 31 suites passing cleanly.

### 📦 Downloads & Installation

| Platform | Variant / Architecture | Direct Download |
| :--- | :--- | :--- |
| **macOS** | Universal (Apple Silicon & Intel) | [frugallm-app_0.0.12_universal.dmg](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.12/frugallm-app_0.0.12_universal.dmg) |
| **Windows** | Standard Installer (`.exe`) | [frugallm-app_0.0.12_x64-setup.exe](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.12/frugallm-app_0.0.12_x64-setup.exe) |
| **Ubuntu** | Debian Installer (`.deb`) | [frugallm-app_0.0.12_amd64.deb](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.12/frugallm-app_0.0.12_amd64.deb) |
| **SteamOS** | Universal Portable (`.AppImage`) | [frugallm-app_0.0.12_amd64.AppImage](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.12/frugallm-app_0.0.12_amd64.AppImage) |
