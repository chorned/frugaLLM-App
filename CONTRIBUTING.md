# Contributing to FrugaLLM

Thank you for your interest in contributing to **FrugaLLM**! We are building a high-performance, local-first proxy and AI routing engine with native cross-platform desktop execution across macOS, Windows, and Linux.

We welcome contributions from everyone, whether you are filing bug reports, improving documentation, submitting pull requests, or participating in discussions.

---

## Code of Conduct

We are committed to providing a friendly, safe, and welcoming environment for all contributors, regardless of experience level, background, or personal identity. Please be respectful, constructive, and collaborative in all project interactions.

---

## Getting Started & Prerequisites

FrugaLLM is built using the **Tauri v2** desktop framework with a **Rust** backend and a **React / TypeScript / Vite** frontend.

### Prerequisites
* **Node.js**: `v24` (or latest Active LTS) and `npm`
* **Rust**: Latest `stable` toolchain (`rustup update stable`)
* **OS-Specific Dependencies**:
  * **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  * **Linux (Debian/Ubuntu)**:
    ```bash
    sudo apt-get update && sudo apt-get install -y \
      libwebkit2gtk-4.1-dev build-essential curl wget file \
      libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf
    ```
  * **Windows**: Microsoft Visual Studio C++ Build Tools & Microsoft Edge WebView2 Runtime.

### Local Installation & Setup
1. **Fork and Clone** the repository:
   ```bash
   git clone https://github.com/<your-username>/frugaLLM-App.git
   cd frugaLLM-App
   ```
2. **Install Frontend Dependencies**:
   ```bash
   npm install
   ```
3. **Run Frontend Dev Server**:
   ```bash
   npm run dev
   ```
4. **Run Full Desktop App in Dev Mode**:
   ```bash
   npm run tauri dev
   ```

---

## 🧪 Testing Policy & Quality Gate (Mandatory)

To maintain stability, security, and cross-platform reliability, FrugaLLM enforces a **strict testing and code quality policy**:

> [!IMPORTANT]
> **Every bug fix and new feature MUST include automated tests.** Pull requests without corresponding unit, integration, or end-to-end tests will not be merged.

### Required Test & Verification Commands
Before opening a pull request, ensure that all test suites pass locally:

1. **Frontend Unit Tests (Vitest)**:
   ```bash
   npm run test:unit
   ```
2. **Backend Rust Tests (Isolated Target)**:
   ```bash
   npm run test:rust
   ```
   *(Note: Always run `npm run test:rust` or set `CARGO_TARGET_DIR=target_test` to prevent Cargo lock conflicts while `tauri dev` is running).*
3. **Full Test Pyramid (Frontend + Backend)**:
   ```bash
   npm run test
   ```
4. **End-to-End Tests (Playwright)**:
   ```bash
   npx playwright test
   ```

---

## 🔍 Compiler & Linter Requirements

All code must compile cleanly with **zero unhandled warnings or errors**:

* **TypeScript Type Checking**:
  ```bash
  npx tsc --noEmit
  ```
  *(Must exit with code 0 with no errors).*
* **Rust Clippy Linting**:
  ```bash
  cd src-tauri && CARGO_TARGET_DIR=target_test cargo clippy -- -D warnings
  ```
  *(All Clippy warnings are treated as errors in CI).*

---

## Pull Request Lifecycle

1. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```
2. **Commit Conventions**:
   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   * `feat(...)`: New user-facing features
   * `fix(...)`: Bug fixes
   * `docs(...)`: Documentation updates
   * `refactor(...)`: Code changes that neither fix a bug nor add a feature
   * `test(...)`: Adding or correcting tests
   * `chore(...)`: Routine tasks, dependency updates, CI workflows
3. **Push & Open a Pull Request**:
   * Target the `main` branch.
   * Provide a concise description of your changes, referencing any related issue numbers (e.g., `Fixes #123`).
   * Verify all GitHub Actions PR Gatekeeper checks pass green.

---

## Community & Issue Tracking

* **Bug Reports & Feature Proposals**: Open a ticket in [GitHub Issues](https://github.com/chorned/frugaLLM-App/issues).
* **General Discussions & Questions**: Join the conversation in [GitHub Discussions](https://github.com/chorned/frugaLLM-App/discussions).
* **Security Vulnerabilities**: **Do not file public issues for security vulnerabilities.** Follow the disclosure instructions in [`SECURITY.md`](SECURITY.md) via [GitHub Security Advisories](https://github.com/chorned/frugaLLM-App/security/advisories/new) or contact `hermes.horned@gmail.com`.
