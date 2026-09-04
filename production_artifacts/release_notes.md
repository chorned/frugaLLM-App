# FrugaLLM v0.0.10 Release Notes

### 🚀 Features
- **Brand Identity & Iconography Refresh:** Complete update of application branding assets and high-resolution multi-density icons across macOS (`.icns`), Windows (`.ico`), Linux (`.png`), iOS, and Android mipmap resolutions.
- **In-App Update Checker & Notification Banner:** Integrated automated release checking against GitHub releases API with semver resolution, non-intrusive banner notifications, and direct release navigation.
- **Accessible Tooltips & Enhanced UI States:** Added a modular `Tooltip` component with micro-interaction states, refined dark/light theme contrast, and smooth hover transitions.

### 🐛 Fixes
- **E2E Terminal Runner Portability:** Removed hardcoded local evidence paths in Playwright terminal runner test suites to ensure deterministic execution across all CI and developer environments.
- **OpenRouter Model Scoring & Filter Handling:** Refined model metric mappings and free alias filtering in both the Rust proxy core and TypeScript router modules.

### 🔧 Under the Hood
- **Security & Dependency Hardening:** Added root `SECURITY.md`, automated GitHub security scanning workflow (`security.yml`), and automated dependency management via `dependabot.yml`.
- **Architectural Feasibility Research:** Completed and documented comprehensive feasibility assessment for headless CLI and Model Context Protocol (MCP) integrations.
- **Extended Test Coverage:** Added unit test suites for `Tooltip`, `UpdateNotification`, `updateChecker`, hover states, and security configurations (158 passing vitest suites).

### 📦 Downloads & Installation

| Platform | Variant / Architecture | Direct Download |
| :--- | :--- | :--- |
| **macOS** | Universal (Apple Silicon & Intel) | [frugallm-app_0.0.10_universal.dmg](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.10/frugallm-app_0.0.10_universal.dmg) |
| **Windows** | Standard Installer (`.exe`) | [frugallm-app_0.0.10_x64-setup.exe](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.10/frugallm-app_0.0.10_x64-setup.exe) |
| **Ubuntu** | Debian Installer (`.deb`) | [frugallm-app_0.0.10_amd64.deb](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.10/frugallm-app_0.0.10_amd64.deb) |
| **SteamOS** | Universal Portable (`.AppImage`) | [frugallm-app_0.0.10_amd64.AppImage](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.10/frugallm-app_0.0.10_amd64.AppImage) |
