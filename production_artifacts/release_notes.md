# FrugaLLM v0.0.17 Release Notes

### 🚀 Features
- **Guarded Dependency Security Hardening**: Enforced patched, modern versions across image processing and serialization libraries while preserving strict SemVer boundaries and API stability.

### 🐛 Fixes
- **Vulnerability Remediation within SemVer Bounds**: Remediated high-severity security advisories across npm and Cargo ecosystems, eliminating CVEs in `serialize-javascript` (GHSA-5c6j-r48x-rmvq, GHSA-qj8w-gfj5-8c6v), `sharp` (GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c), and `adm-zip` (GHSA-xcpc-8h2w-3j85, GHSA-vwc7-r8mq-g2x9) via non-breaking dependency overrides.

### 🔧 Under the Hood
- **CI Security & Least-Privilege Hardening**: Enforced least-privilege token permissions across GitHub Actions workflows and pinned automation commands to safeguard repository pipelines.
- **Cargo Dependency Synchronization**: Updated transitive crates (`synstructure`, `yoke-derive`, `zerofrom-derive`) in the Cargo lockfile for complete multi-platform stability across macOS, Windows, and Linux.

### 📦 Downloads & Installation

| Platform | Variant / Architecture | Direct Download |
| :--- | :--- | :--- |
| **macOS** | Universal (Apple Silicon & Intel) | [frugallm-app_0.0.17_universal.dmg](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.17/frugallm-app_0.0.17_universal.dmg) |
| **Windows** | Standard Installer (`.exe`) | [frugallm-app_0.0.17_x64-setup.exe](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.17/frugallm-app_0.0.17_x64-setup.exe) |
| **Ubuntu** | Debian Installer (`.deb`) | [frugallm-app_0.0.17_amd64.deb](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.17/frugallm-app_0.0.17_amd64.deb) |
| **SteamOS** | Universal Portable (`.AppImage`) | [frugallm-app_0.0.17_amd64.AppImage](https://github.com/chorned/frugaLLM-App/releases/download/v0.0.17/frugallm-app_0.0.17_amd64.AppImage) |
