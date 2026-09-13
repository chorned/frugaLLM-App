# FrugaLLM Cross-Platform System Architecture

This document provides an exhaustive, authoritative architectural reference for **FrugaLLM**, detailing how the application is designed, how it is currently optimized for **macOS** and **Linux**, and how **Windows** functionality is architected to achieve first-class feature parity without damaging Unix-based platforms.

---

## 1. System Topology & Core Subsystems

FrugaLLM is a local-first, low-latency AI proxy and autonomous agent orchestration desktop application built on **Tauri v2** (Rust backend + React 19 / TypeScript / Vite frontend).

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React 19 / Vite)                         │
│   Canvas UI • Node Property Modals • Dual Telemetry Hub • TerminalView (xterm)  │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ Tauri IPC Bridge (invoke / events)
┌────────────────────────────────────────▼────────────────────────────────────────┐
│                              TAURI BACKEND (Rust)                               │
│                                                                                 │
│   ┌───────────────────────────┐           ┌─────────────────────────────────┐   │
│   │    Axum Proxy Server      │           │    Hardware & Telemetry Engine  │   │
│   │  - 127.0.0.1:<port>       │           │  - Apple Silicon Unified Mem    │   │
│   │  - /v1/chat/completions   │           │  - Intel Mac system_profiler    │   │
│   │  - /v1/models             │           │  - Linux / Windows NVML & sys   │   │
│   │  - Dynamic Roster Chain   │           │  - KV Cache Formula Calculator  │   │
│   │  - Circuit Breaker (429)  │           └─────────────────────────────────┘   │
│   └─────────────┬─────────────┘                                                 │
│                 │                                                               │
│   ┌─────────────▼─────────────┐           ┌─────────────────────────────────┐   │
│   │   Process & PTY Manager   │           │   Config & Shell Integration    │   │
│   │  - ChildProcessManager    │           │  - Unix: ~/.local/bin symlinks  │   │
│   │  - portable_pty (ConPTY)  │           │  - Unix: .zshrc / .bashrc export│   │
│   │  - Daemon Supervisor      │           │  - Win: Registry User PATH sync │   │
│   └───────────────────────────┘           └─────────────────────────────────┘   │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ Native OS Subsystems
┌────────────────────────────────────────▼────────────────────────────────────────┐
│                              HOST PLATFORMS                                     │
│     macOS (Darwin x86_64 / arm64)  │  Linux (WebKit2GTK)  │  Windows 11/10      │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Core Responsibilities:
1. **Local Proxy Core (`src-tauri/src/proxy/server.rs`)**:
   - Axum-based HTTP daemon listening on `127.0.0.1:port` (default `61721` or user-defined, e.g. `8080`).
   - Implements full OpenAI API specifications (`/v1/chat/completions`, `/v1/models`).
   - Dynamic intelligent routing across local Ollama instances, OpenRouter cloud, and Google AI Studio Gemini models.
   - Circuit breakers (`ProviderHealthState`) handling rate-limiting (429), timeouts, and auth errors (403).
   - In-flight token usage streaming and lifetime telemetry metrics extraction.
   - Strict Tool-Calling Enforcement Gateway (`TOOL_ENFORCEMENT_DIRECTIVE`).

2. **Telemetry & VRAM Engine (`src-tauri/src/telemetry.rs`, `src-tauri/src/commands/system.rs`)**:
   - Real-time 1 Hz hardware polling and 2 Hz Ollama status polling emitted over `telemetry_update`.
   - Computes Gemma 4 128k Q8 KV cache requirements (5:1 interleaved attention ratio).
   - Calculates memory ceilings, spillover thresholds (System RAM vs SSD swap), and warnings.

3. **Process Supervisor & Terminal Runner (`src-tauri/src/proxy/process.rs`, `src-tauri/src/commands/pty.rs`)**:
   - Manages child daemon lifecycles (Hermes Agent Gateway, Hermes Web, OpenCode Engine, Ollama daemon).
   - Embedded interactive pseudo-terminal (`portable-pty` + `@xterm/xterm`) for installation runtimes and CLI interactions.

4. **Configuration & Shell Synchronization (`src-tauri/src/commands/config.rs`)**:
   - Persists proxy configuration to `frugal_config.json` via debounced atomic disk writers.
   - Synchronizes global CLI tools (`hermes`, `opencode`, `ollama`) into user shell environments.

5. **Security & Credentials (`src-tauri/src/db.rs`)**:
   - Uses OS-native keyring (`keyring` crate) in production builds:
     - **macOS**: Apple Keychain Service
     - **Windows**: Windows Credential Manager
     - **Linux**: Secret Service API / DBus
   - Falls back to `.env` exclusively under debug assertions.

---

## 2. macOS Architectural Optimizations

FrugaLLM was engineered with first-class optimizations for macOS hosts (both Apple Silicon and Intel x86_64).

### 2.1 Hardware Profiling & VRAM Detection
- **Dual-Architecture Awareness**:
  - Differentiates Apple Silicon (`target_arch = "aarch64"`) from Intel Macs (`target_arch = "x86_64"`).
  - Queries total system RAM directly using `sysctl -n hw.memsize`.
- **Apple Silicon Unified Memory**:
  - Marks `is_unified = true`, `dedicated_vram = 0`.
  - Calculates execution ceiling as `system_ram.saturating_sub(2 GB)` to protect macOS OS kernel buffers.
  - Paging warnings detect SSD swap memory exhaustion.
- **Intel Mac Discrete GPU**:
  - On Intel Macs, queries `system_profiler SPDisplaysDataType` via async tokio subshell.
  - Parses `VRAM (Total):` and `VRAM (Dynamic, Max):` lines in MB and GB units.

### 2.2 Daemon & Binary Discovery
- Checks macOS app bundles alongside standard PATH locations:
  - `/Applications/Ollama.app/Contents/MacOS/Ollama`
  - `/Applications/Ollama.app/Contents/Resources/ollama`
  - `/opt/homebrew/bin` (Homebrew Apple Silicon path)
  - `/usr/local/bin` (Homebrew Intel path)
- **Bare Directory Protection**:
  - Specifically verifies that the executable binary inside `Contents/MacOS/Ollama` exists rather than falsely identifying an empty or uninstalled `/Applications/Ollama.app` folder.

### 2.3 Headless Ollama Installation
- Uses custom installation flag: `export OLLAMA_NO_START=1 && curl -fsSL https://ollama.com/install.sh | sh`.
- `OLLAMA_NO_START=1` prevents the upstream script from executing `open -a Ollama`, allowing FrugaLLM's internal daemon manager (`start_ollama_daemon`) to retain full supervision over the daemon's PID, STDERR streaming, and lifecycle.

### 2.4 Process Orchestration & Tree Signaling
- Process termination uses standard POSIX signals:
  - `pkill -TERM -P <pid>` followed by `kill -TERM <pid>`.
  - 50ms graceful buffer followed by SIGKILL (`pkill -9 -P <pid>` and `kill -9 <pid>`).
  - Broad service cleanup using `pkill -9 -f "hermes dashboard"`, etc.

### 2.5 Shell & Path Integration
- Detects macOS default `.zshrc` shell configuration:
  - Automatically creates `.zshrc` if missing on macOS when global CLI commands are enabled.
  - Injects idempotent `# >>> FrugaLLM CLI PATH >>>` export blocks into `.zshrc`, `.bashrc`, and `.profile`.
  - Creates symlinks in `~/.local/bin` and `/usr/local/bin`.

### 2.6 Native App & Launch Integration
- Autostart configured via `tauri_plugin_autostart::MacosLauncher::LaunchAgent` (`~/Library/LaunchAgents/`).
- System viewer uses `open -t <path>`.
- Release pipeline cross-compiles a universal binary (`--target universal-apple-darwin`), signed with Developer ID Certificate and notarized via App Store Connect API keys.

---

## 3. Linux Architectural Optimizations

### 3.1 Hardware Telemetry
- Evaluates total RAM via `sysinfo::System`.
- Discrete GPU detection implemented via `nvml-wrapper` interfacing with NVIDIA NVML drivers.

### 3.2 Process Management
- Implements process group signaling with POSIX `pkill` and `kill`.
- Clean separation between daemon child processes and slave PTY sessions.

### 3.3 Packaging & Ecosystem
- Relies on WebKit2GTK 4.1 (`libwebkit2gtk-4.1-dev`), `libgtk-3-dev`, and `libayatana-appindicator3-dev` for system tray support.
- File viewing fallbacks to `xdg-open`.
- Shell configuration syncs with `.bashrc` and `.profile`.

---

## 4. Windows Architecture & Current Implementations

Windows requires distinct handling due to the Win32 API model, NT process tree semantics, ConPTY behavior, and PowerShell execution policies.

### 4.1 Win32 Subsystem & Console Suppression
- `main.rs` configures:
  ```rust
  #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
  ```
  This prevents a persistent blank `cmd.exe` console window from appearing behind the Tauri GUI in release builds.
- All background commands (`tokio::process::Command` and `std::process::Command`) pass `creation_flags(0x08000000)` (`CREATE_NO_WINDOW`) when executed on Windows to prevent console flashing during telemetry checks or daemon launches.

### 4.2 Headless Ollama Installation Pattern
- Downloader and installer run headlessly via PowerShell without triggering the Windows installer onboarding UI:
  1. Stops any existing `ollama app` or `ollama` processes with `Stop-Process -Force -ErrorAction SilentlyContinue`.
  2. Pre-creates the official marker file:
     `%LOCALAPPDATA%\Ollama\upgraded`
     Ollama's Windows installer explicitly checks for this marker; when present, it suppresses the first-time "Run Ollama" interactive prompt.
  3. Downloads `OllamaSetup.exe` to `$env:TEMP` using `Invoke-WebRequest -UseBasicParsing`.
  4. Executes installer silently using `Start-Process -FilePath $tempInstaller -ArgumentList '/VERYSILENT /NORESTART /CLOSEAPPLICATIONS /SUPPRESSMSGBOXES' -PassThru` and waits strictly on `$proc.WaitForExit()`.
  5. Updates user environment `Path` variable in registry.

### 4.3 Shell PATH Management
- Windows does not use `.bashrc` or symlinks for PATH; instead, FrugaLLM modifies the user environment block:
  ```powershell
  [Environment]::GetEnvironmentVariable('Path', 'User')
  ```
  It adds or removes:
  - `%LOCALAPPDATA%\hermes\bin`
  - `%LOCALAPPDATA%\Programs\opencode`
  - `%LOCALAPPDATA%\Programs\Ollama`
  - `%USERPROFILE%\.hermes\bin`
  - `%USERPROFILE%\.local\bin`
  - `%USERPROFILE%\.opencode\bin`

### 4.4 Process Tree Termination
- Windows does not support POSIX signals (`SIGTERM`/`SIGKILL`).
- Child process tree termination utilizes:
  ```cmd
  taskkill /F /T /PID <pid>
  taskkill /F /T /IM <image_name>.exe
  ```
- *Known issue to avoid:* When the target process is not currently running, `taskkill` exits with code 128 and prints `ERROR: The process ... not found.` to stderr unless suppressed.

### 4.5 ConPTY & Terminal Emulation
- Utilizes `portable-pty::NativePtySystem`, which maps to Windows ConPTY on Windows 10/11.
- Spawns `powershell.exe` with `-NoProfile -NonInteractive -ExecutionPolicy Bypass`.
- Augments environment `PATH` directly in child process builder before launch.

### 4.6 CI & Test WebDriver Policies
- In `.github/workflows/release.yml`, Windows smoke tests configure EdgeDriver and set WebView2 remote debugging registry keys:
  - `HKLM:\SOFTWARE\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments`
  - `HKCU:\SOFTWARE\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments`
  Setting `--remote-debugging-port=0 --no-sandbox --disable-gpu` allows Tauri WebDriver testing on headless Windows CI runners.

---

## 5. The "Never Break macOS/Linux" Prime Directive

All future development on Windows must follow these architectural rules to safeguard cross-platform stability:

1. **Strict Target Gate Separation**:
   - Windows-specific imports (`std::os::windows::...`) and logic MUST be guarded with `#[cfg(target_os = "windows")]` or `#[cfg(windows)]`.
   - Unix and macOS logic MUST remain guarded with `#[cfg(target_os = "macos")]`, `#[cfg(target_os = "linux")]`, or `#[cfg(unix)]`.
   - Never replace a working Unix implementation with cross-platform compromise code if the Unix version is already optimal.

2. **No Blind OS Commands**:
   - Never call `cmd.exe`, `powershell.exe`, or `taskkill` on Unix platforms.
   - Never call `pkill`, `kill`, `open`, `sysctl`, or `sh` on Windows platforms.

3. **Safe Path Normalization**:
   - Never hardcode `/` or `\` in filesystem manipulation. Always construct paths using `std::path::PathBuf` and `.join(...)`.

4. **Non-Blocking ConPTY Handling**:
   - ConPTY reads on Windows do not terminate with Unix EOF when a slave handle drops. Ensure PTY reading threads use non-blocking reads or terminate cleanly when the child process exits.

5. **Test State Isolation**:
   - Mock tests in `src-tauri/src/tests.rs` must isolate environment variables (`LOCALAPPDATA`, `PATH`) so they do not query the host system's real installed applications.
