---
name: windows-development
description: >-
  Provides surgical guidelines, rules, diagnostic patterns, and verification procedures for developing,
  optimizing, and testing FrugaLLM on Windows while strictly safeguarding 100% feature parity and stability
  for macOS and Linux. Use when modifying OS-specific code (Rust cfg, process spawning, ConPTY, hardware detection,
  PATH synchronization, or PowerShell scripts) or troubleshooting Windows builds and tests.
license: Apache-2.0
metadata:
  version: v1
  author: FrugaLLM Lead Architect
---

# Windows Development Skill

This skill governs all development, optimization, and debugging of FrugaLLM for **Windows 10/11**. It enforces surgical precision to guarantee that Windows enhancements **never regress or break macOS or Linux functionality**, while resolving Windows-specific subsystems (Win32 APIs, ConPTY, PowerShell, NT process trees, registry environment variables, and WebView2).

---

## The 7 Surgical Windows Engineering Principles

Every change targeting Windows must comply with these seven core principles:

### 1. Strict Target Isolation (Zero Unix Regression)
- **Principle:** Every Windows-specific code branch, dependency, or system call must be strictly gated using `#[cfg(target_os = "windows")]` or `#[cfg(windows)]`.
- **Mandate:**
  - Never mutate or weaken existing `#[cfg(target_os = "macos")]`, `#[cfg(target_os = "linux")]`, or `#[cfg(unix)]` blocks when making Windows edits.
  - If a function has differing implementations across OSes, maintain clean compile-time branching:
    ```rust
    #[cfg(target_os = "windows")]
    {
        // Windows-specific implementation
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Unix (macOS / Linux) implementation
    }
    ```
  - Never introduce Unix-only utilities (`pkill`, `kill`, `sysctl`, `open`, `sh`) into Windows blocks, and never invoke Windows-only binaries (`powershell.exe`, `cmd.exe`, `taskkill.exe`, `notepad.exe`) in Unix blocks.

### 2. Silent & Clean Process Tree Termination
- **Principle:** Windows handles process trees differently from POSIX. Windows processes do not receive `SIGTERM` or `SIGKILL`.
- **Mandate:**
  - When killing process trees on Windows, use `taskkill /F /T /PID <pid>` or `taskkill /F /T /IM <image>.exe`.
  - **Stderr Suppression:** If a target process is already dead or not running, `taskkill` exits with code 128 and prints `ERROR: The process "..." not found.` to stderr. You must silence this noise by redirecting stdout/stderr or using PowerShell `Stop-Process -ErrorAction SilentlyContinue`:
    ```rust
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("taskkill")
            .args(&["/F", "/T", "/PID", &pid.to_string()])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status();
    }
    ```
  - When spawning background daemons or silent scripts, always attach `creation_flags(0x08000000)` (`CREATE_NO_WINDOW`) to prevent console flashing.

### 3. ConPTY & Asynchronous Stream Safety
- **Principle:** Windows pseudo-terminals (ConPTY via `portable-pty`) do NOT send standard POSIX EOF markers when a child process exits.
- **Mandate:**
  - A synchronous blocking `reader.read(&mut buf)` on a ConPTY handle will hang permanently if the child process has exited without closing the channel.
  - Terminal readers must operate in dedicated asynchronous tasks or non-blocking threads that listen for child process exit signals to break the read loop.
  - Unit tests that test PTY functionality must avoid indefinite blocking read loops on Windows.

### 4. Whitespace & Path Quotation Defense
- **Principle:** Windows user profile paths commonly contain whitespace (e.g. `C:\Users\John Doe\AppData\Local\...`).
- **Mandate:**
  - In Rust, never assemble file paths via manual string concatenation. Always use `std::path::PathBuf` and `.join(...)`.
  - In PowerShell strings (such as inside `TerminalView.tsx` or `agents.rs`), all interpolated paths, executables, and arguments **MUST** be explicitly quoted:
    ```powershell
    # Correct
    $binDir = Join-Path $HOME '.opencode\bin';
    & "$hermesBin" gateway --host 127.0.0.1

    # Incorrect (will fail on paths with spaces)
    $binDir = $HOME + '\.opencode\bin'
    $hermesBin gateway
    ```
  - When executing batch files (`.cmd` or `.bat`) like `hermes.cmd`, wrap invocation through `cmd.exe /C "<path>"`.

### 5. Unit Test State Isolation (No Host Contamination)
- **Principle:** Unit tests must remain hermetic and must not fail on Windows developer machines that have development tools installed.
- **Mandate:**
  - Functions like `get_hermes_source_path` or `get_opencode_source_path` inspect `%LOCALAPPDATA%` and `%PATH%`.
  - When writing unit tests with mock directories, isolate environment variables or provide mockable path overrides so that an existing `hermes.exe` on the developer's Windows PATH does not cause `assert_eq!(is_installed, false)` to fail.

### 6. Hardware Telemetry & Graceful GPU Fallback
- **Principle:** While macOS unified memory is queried via `sysctl`, Windows machines vary widely (NVIDIA discrete GPUs, AMD Radeon GPUs, Intel Arc / Iris Xe GPUs, or integrated APUs).
- **Mandate:**
  - Non-macOS hardware profiling currently queries `nvml_wrapper::Nvml::init()`.
  - On Windows machines without an NVIDIA GPU, NVML initialization fails. The code must gracefully fall back to total system memory minus the standard 2GB OS reserve buffer without panicking.
  - Never assume NVML is present or that device index 0 is valid without error checking.

### 7. Frontend Locale & Platform Invariants
- **Principle:** Windows machines in different regional locales (e.g., French, Swedish, German) format numbers differently with `toLocaleString()` (using spaces instead of commas).
- **Mandate:**
  - In React tests, never assert hardcoded thousand separators like `expect(el).toHaveTextContent('6,000')` without accounting for locale non-breaking spaces, or specify an explicit locale (e.g., `(val).toLocaleString('en-US')`).
  - In frontend platform detection, use `isWindowsPlatform()` in `src/components/TerminalView.tsx` which safely checks both `navigator.platform` and `navigator.userAgent`.

---

## Step-by-Step Procedure for Windows Changes

When tasked with adding, editing, or optimizing any Windows feature:

### Step 1: Pre-Change Impact Assessment
1. Identify all affected files.
2. Verify if the target file contains macOS or Linux logic.
3. Consult the [Cross-Platform Architecture Matrix](./references/cross_platform_matrix.md) to understand existing invariants.

### Step 2: Surgical Implementation
1. If adding a Windows-specific command or branch, write the `#[cfg(target_os = "windows")]` block.
2. Ensure the complementary `#[cfg(not(target_os = "windows"))]` block remains 100% intact and unedited unless cross-platform abstraction is explicitly required.
3. Apply `CREATE_NO_WINDOW` (`0x08000000`) to any new `tokio::process::Command` or `std::process::Command`.
4. Suppress stderr on any cleanup `taskkill` calls.
5. In PowerShell scripts, quote all paths and pass `-NoProfile -NonInteractive -ExecutionPolicy Bypass`.

### Step 3: Local Verification on Windows
Run verification steps:
```bash
# 1. Compile backend without warnings
cargo check --manifest-path src-tauri/Cargo.toml

# 2. Run backend tests
npm run test:rust
# or: cd src-tauri && cargo test

# 3. Run frontend tests
npm run test:unit

# 4. Verify release compilation
npm run build
```

### Step 4: Verification Checklist
Review your changes against the [Windows Pitfalls Checklist](./references/windows_pitfalls_checklist.md) before submitting or pushing code.

---

## GitHub Authentication & Environment Configuration (.env)

FrugaLLM maintains sensitive developer environment variables in the project root [.env](file:///c:/Users/chorned/projects/frugaLLM-App/.env) (guaranteed to be `.gitignore`d). This includes the GitHub credentials for user `hermeshorned`:

```env
GITHUB_USER=hermeshorned
GITHUB_TOKEN=ghp_...
GH_TOKEN=ghp_...
```

### Loading `.env` in Windows PowerShell
When running automated commands, releases, or GitHub CLI operations in PowerShell, source the variables into the current session process:

```powershell
# Sourcing .env into the active PowerShell session:
Get-Content .env | Where-Object { $_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$' } | ForEach-Object {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
}
```

### Executing Authenticated GitHub CLI & Git Operations on Windows:
1. **GitHub CLI (`gh`):**
   ```powershell
   $env:GH_TOKEN = (Get-Content .env | Select-String '^GH_TOKEN=').Line.Split('=', 2)[1].Trim()
   gh release view
   ```
2. **Git Commands with Basic Auth (`git push`):**
   When basic auth token forwarding is required (per [.agents/rules/github-auth.md](file:///c:/Users/chorned/projects/frugaLLM-App/.agents/rules/github-auth.md)):
   ```powershell
   $user = "hermeshorned"
   $token = (Get-Content .env | Select-String '^GITHUB_TOKEN=').Line.Split('=', 2)[1].Trim()
   git remote set-url origin "https://${user}:${token}@github.com/chorned/frugaLLM-App.git"
   ```

---

## Diagnostic Reference

| Symptom / Issue | Root Cause | Surgical Fix |
|---|---|---|
| Console window flashes when clicking actions | Child command spawned without `CREATE_NO_WINDOW` | Add `cmd.creation_flags(0x08000000);` under `#[cfg(target_os = "windows")]` |
| `ERROR: The process "hermes.exe" not found` in terminal | `taskkill` outputting to stderr when process is absent | Route stderr to `Stdio::null()` |
| Unit tests hang on `test_dummy_pty_execution` | ConPTY reader waiting for Unix EOF that never arrives | Use timeout-guarded async read or non-blocking loop |
| Installer fails with `The term 'C:\Users\...' is not recognized` | Username or path contains whitespace | Wrap variable in double quotes: `"& \"$bin\""` |
| First-time Ollama installation shows onboarding window | Missing upgraded marker | Ensure `%LOCALAPPDATA%\Ollama\upgraded` file is created before setup |
| Frontend test fails with `Expected "6,000" Received "6 000"` | Windows system locale uses non-breaking space for thousands | Normalize with `.replace(/\s/g, ',')` or use `'en-US'` in `toLocaleString()` |
