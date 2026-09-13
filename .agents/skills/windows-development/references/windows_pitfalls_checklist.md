# Windows Development Pitfalls & Pre-Commit Checklist

Before submitting, committing, or opening a PR with changes impacting Windows, verify every item on this checklist:

---

### 1. Conditional Compilation Gating
- [ ] Are all Windows-specific imports (`std::os::windows::...`) guarded by `#[cfg(target_os = "windows")]` or `#[cfg(windows)]`?
- [ ] Are macOS and Linux implementations preserved completely intact without regressions?
- [ ] Does `cargo check --manifest-path src-tauri/Cargo.toml` complete with **zero** warnings?

### 2. Process Spawning & Stealth
- [ ] Does every spawned background process (via `tokio::process::Command` or `std::process::Command`) apply `.creation_flags(0x08000000)` (`CREATE_NO_WINDOW`) on Windows?
- [ ] Are `taskkill` calls redirected to `Stdio::null()` for both stdout and stderr to eliminate `ERROR: The process ... not found` spam?

### 3. ConPTY Stream Safety
- [ ] Does PTY output reading avoid blocking indefinitely on child exit?
- [ ] Is `portable-pty` sized properly (`cols`, `rows`) before emitting terminal stream events?

### 4. Whitespace & Quoting Invariants
- [ ] Are all Windows paths in PowerShell commands wrapped in quotes?
  - Example: `& "$exePath" arg1` instead of `& $exePath arg1`.
- [ ] Are paths constructed using `Path::join` / `PathBuf` instead of raw string concatenation?
- [ ] If invoking `.cmd` or `.bat` files, are they passed through `cmd.exe /C "<path>"`?

### 5. Headless Installer Invariants
- [ ] Does the Ollama Windows installer flow verify `%LOCALAPPDATA%\Ollama\upgraded` exists before running the setup executable?
- [ ] Does the installer execution use `-PassThru` with `$proc.WaitForExit()` to prevent hanging on detached background sub-processes?

### 6. Shell Environment Synchronization
- [ ] Does PATH update target `[Environment]::GetEnvironmentVariable('Path', 'User')` and NOT overwrite system machine PATH?
- [ ] Are existing PATH entries preserved when adding or removing FrugaLLM directories?

### 7. Unit Test Isolation
- [ ] Do backend unit tests avoid querying the real host machine's `%LOCALAPPDATA%` or `%PATH%` when testing empty/uninstalled states?
- [ ] If testing file writing, are handles flushed and closed before reading or deleting to prevent `ERROR_SHARING_VIOLATION` (0x20)?

### 8. Frontend Number & Locale Formatting
- [ ] Do React components and tests avoid assuming a specific decimal or thousands separator (e.g. comma vs space in `toLocaleString()`)?

### 9. Web Driver & WebView2 CI Compatibility
- [ ] Does the release workflow (`release.yml`) include EdgeDriver download and WebView2 policy flags for Windows headless testing?

### 10. Clean Cleanup on Exit
- [ ] When the app is closed or wiped, are all child processes (Hermes, OpenCode, Ollama) cleanly stopped without leaving orphaned zombie processes?
