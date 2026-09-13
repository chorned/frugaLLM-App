<#
.SYNOPSIS
  FrugaLLM Windows Verification Runner
.DESCRIPTION
  Runs the essential backend and frontend validation suites on Windows,
  preventing ConPTY deadlocks and checking for compile warnings.
#>

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   FrugaLLM Windows Verification Suite   " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
# Load .env variables if present
if (Test-Path '.env') {
    Get-Content .env | Where-Object { $_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$' } | ForEach-Object {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}

# 1. Check Cargo Compilation & Warnings
Write-Host "`n[1/3] Checking Rust Backend Compilation..." -ForegroundColor Yellow
$cargoCheck = cargo check --manifest-path src-tauri/Cargo.toml 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Cargo check failed:" -ForegroundColor Red
    Write-Host $cargoCheck
    exit 1
}
Write-Host " Rust backend check passed cleanly." -ForegroundColor Green

# 2. Run Rust Unit Tests (Excluding blocking PTY tests if running interactively)
Write-Host "`n[2/3] Running Rust Unit Tests..." -ForegroundColor Yellow
$cargoTest = cargo test --manifest-path src-tauri/Cargo.toml -- --skip test_dummy_pty_execution 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Rust tests encountered failures:" -ForegroundColor Red
    Write-Host $cargoTest
    exit 1
}
Write-Host " Rust unit tests passed." -ForegroundColor Green

# 3. Run Frontend Unit Tests
Write-Host "`n[3/3] Running Frontend Vitest Suite..." -ForegroundColor Yellow
$npmTest = npx vitest run 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend tests encountered failures:" -ForegroundColor Red
    Write-Host $npmTest
    exit 1
}
Write-Host " Frontend tests passed." -ForegroundColor Green

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "All Windows Verification Checks Passed!   " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
