# FrugaLLM v0.0.8 Release Notes

## 🚀 Features
- **OS Autostart & Launch-on-Login:** Added native desktop autostart support via Tauri plugin, allowing users to configure FrugaLLM to start automatically on login with optional background/minimized execution.
- **Background Agent Exit Safeguard:** Implemented an exit confirmation dialog that proactively detects running agent processes (Hermes Gateway / WebUI) and prompts users before terminating background sessions.
- **Enhanced Global Cloud Routing Panel:** Added fine-grained manual model ranking controls (Rank Top, Rank Up, Rank Down, Reset Rank) alongside live scoring and clear indicators for rate-limited (429) models.
- **Keychain Secret Masking & Placeholders:** Improved API key security in node configurations with masked placeholder text (`•••••••••••••••• (Key Configured)`) for saved Keychain credentials.

## 🛠️ Fixes
- **UI Copy & Localization Standardization:** Extracted remaining hardcoded strings in Cloud Routing, Node Widgets, and Dialogs into the localized `en.json` CMS dictionary.
- **Hermes Process Lifecycle Management:** Streamlined Hermes Gateway and WebUI launch and termination flow with unified app actions.
- **Port Conflict UX Polish:** Improved error handling and status badge presentation during server port collision scenarios.

## 🔧 Under the Hood
- **E2E Test Suite & Page Object Model Hardening:** Standardized Playwright semantic selectors and resilient assertions across Main Canvas, Hardware Telemetry, Memory Pipeline, and Terminal Runner test suites.
- **Windows Release Smoke Testing Fixes:** Resolved EdgeOptions and WebView2 policy configuration in CI release smoke tests.
- **macOS Universal Binary Target:** Updated release compilation workflow to generate universal macOS binaries supporting both Apple Silicon and Intel x86_64 architectures.

### 📦 Downloads & Installation

| Platform | Variant / Architecture | Direct Download |
| :--- | :--- | :--- |
| **macOS** | Universal (Apple Silicon & Intel) | [frugallm-app_0.0.8_universal.dmg](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.8/frugallm-app_0.0.8_universal.dmg) |
| **Windows** | Standard Installer (`.exe`) | [frugallm-app_0.0.8_x64-setup.exe](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.8/frugallm-app_0.0.8_x64-setup.exe) |
| **Ubuntu** | Debian Installer (`.deb`) | [frugallm-app_0.0.8_amd64.deb](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.8/frugallm-app_0.0.8_amd64.deb) |
| **SteamOS** | Universal Portable (`.AppImage`) | [frugallm-app_0.0.8_amd64.AppImage](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.8/frugallm-app_0.0.8_amd64.AppImage) |
