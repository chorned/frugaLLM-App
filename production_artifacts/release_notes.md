# FrugaLLM v0.0.18 Release Notes

### 🚀 Features
- **Guided Onboarding Experience & Interactive Setup**: Introduced an interactive 7-step guided onboarding overlay, first-launch decision modal, native terminal runner for agent installation, and live progress tracking.
- **Quick Provider Key Acquisition**: Replaced static key placeholders with direct "Get Key" provider hyperlinks for streamlined initial credential configuration.

### 🐛 Fixes
- **Responsive Window Viewport Sizing**: Defaulted initial viewport dimensions to 1150x750 with safe screen boundary clamping, preventing oversized or stale window restoration across varied display resolutions.
- **Build Credential Protection**: Protected local and CI build credentials via `.env.build` resolution while ensuring reliable debug profile fallbacks and offline build support.

### 🔧 Under the Hood
- **Native Terminal Execution Engine**: Added cross-platform pseudo-terminal command execution and streaming in the Tauri backend for tool installations.
- **Comprehensive QA Test Suite**: Added rigorous test coverage across onboarding state transitions, footer trackers, credential validation boundaries, and single-instance deep-wipe handlers.

### 📦 Downloads & Installation

| Platform | Variant / Architecture | Direct Download |
| :--- | :--- | :--- |
| **macOS** | Universal (Apple Silicon & Intel) | [frugallm-app_0.0.18_universal.dmg](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.18/frugallm-app_0.0.18_universal.dmg) |
| **Windows** | Standard Installer (`.exe`) | [frugallm-app_0.0.18_x64-setup.exe](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.18/frugallm-app_0.0.18_x64-setup.exe) |
| **Ubuntu** | Debian Installer (`.deb`) | [frugallm-app_0.0.18_amd64.deb](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.18/frugallm-app_0.0.18_amd64.deb) |
| **SteamOS** | Universal Portable (`.AppImage`) | [frugallm-app_0.0.18_amd64.AppImage](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.18/frugallm-app_0.0.18_amd64.AppImage) |
