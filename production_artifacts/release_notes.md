# FrugaLLM v0.0.7 Release Notes

## 🚀 Features
- **Server Port Conflict Detection & Notification Banner:** Added real-time port binding conflict detection on backend startup with an interactive UI alert banner and Hub status indicator prompting users to close conflicting background processes or customize the server port.

## 🛠️ Fixes
- **CI Test Suite Compatibility:** Standardized CI workflows on Node.js 22 and aligned Cargo test manifest paths across continuous integration runners.
- **PR Check Isolation:** Separated pre-merge PR validation gates from multi-platform release pipelines.

## 🔧 Under the Hood
- **Automated Artifact Smoke Testing:** Added automated post-build binary verification in the release workflow using `tauri-driver` and WebdriverIO to physically boot compiled release artifacts and verify webview initialization on Linux (`xvfb` + WebKitGTK) and Windows.
