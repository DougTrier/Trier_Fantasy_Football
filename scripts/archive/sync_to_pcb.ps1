<#
.SYNOPSIS
    One-way mirror sync from Local Repo (PC-A) to PC-B via Network Drive (R:\)
    SAFELY mirrors source to target.

.DESCRIPTION
    Uses Robocopy /MIR to ensure PC-B is identical to PC-A.
    Excludes sensitive/build folders (node_modules, target, etc).
    Includes preflight checks to prevent accidents.

.USAGE
    .\sync_to_pcb.ps1
#>

$ErrorActionPreference = "Stop"

# --- CONFIGURATION ---
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceDir = Resolve-Path "$ScriptDir\.." # Repo Root
$TargetRoot = "R:" # PC-B Share Root (Mapped Drive)

$LogDir = "$SourceDir\output\sync_logs"
if (!(Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$LogFile = "$LogDir\sync_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

# Exclusions
$ExcludedDirs = @(
    "node_modules",
    "src-tauri\target",
    "dist",
    "build",
    ".vite",
    ".turbo",
    ".git",
    "output",
    "coverage"
)

$ExcludedFiles = @(
    "*.log",
    "*.tmp",
    "*.bak",
    ".DS_Store",
    "Thumbs.db"
)

# --- PREFLIGHT CHECKS ---
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   PC-A -> PC-B  ONE-WAY MIRROR SYNC" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Source: $SourceDir"
Write-Host "Target: $TargetRoot"
Write-Host "Log:    $LogFile"
Write-Host "----------------------------------------------"

# 1. Check Source Validity
if (!(Test-Path "$SourceDir\package.json")) {
    Write-Error "CRITICAL: Source does not look like TrierFantasy repo (missing package.json)."
}

# 2. Check Target Reachability & Validity
if (!(Test-Path $TargetRoot)) {
    Write-Error "CRITICAL: Target drive R:\ not found or reachable. Make sure PC-B is mounted."
}

# 3. Target Guardrail - Ensure we are syncing to the right place
# If target is empty, we allow it (initial sync). If not empty, it MUST have markers.
if ((Get-ChildItem $TargetRoot).Count -gt 0) {
    if (!(Test-Path "$TargetRoot\package.json") -and !(Test-Path "$TargetRoot\src-tauri")) {
        Write-Warning "TARGET SAFETY CHECK FAILED: Target folder is not empty but missing project markers."
        Write-Warning "To prevent accidental data loss, this script will ABORT."
        Write-Error "Target validation failed."
    }
}

# --- EXECUTION ---
Write-Host "Starting Sync..." -ForegroundColor Yellow

$RoboArgs = @(
    "$SourceDir",
    "$TargetRoot",
    "/MIR",       # Mirror (Copy + Delete extras)
    "/FFT",       # Loose file times (2 sec granularity for network shares)
    "/Z",         # Restartable mode
    "/R:2",       # Retry 2 times
    "/W:2",       # Wait 2 sec between retries
    "/NP",        # No Progress bar (cleaner logs)
    "/NDL",       # No Directory List
    "/NFL",       # No File List (unless error) - TEE handles visible output
    "/TEE",       # Output to console and log
    "/LOG+:$LogFile",
    "/XJ"         # Exclude Junction points
)

# Add exclusions
foreach ($dir in $ExcludedDirs) { $RoboArgs += "/XD"; $RoboArgs += "$dir" }
foreach ($file in $ExcludedFiles) { $RoboArgs += "/XF"; $RoboArgs += "$file" }

Write-Host "Running Robocopy..." -ForegroundColor DarkGray
# Use Call Operator & which handles quoting automatically
& "robocopy" $RoboArgs
$ExitCode = $LASTEXITCODE

Write-Host "----------------------------------------------"
if ($ExitCode -lt 8) {
    Write-Host "SYNC COMPLETED SUCCESSFULLY (Code: $ExitCode)" -ForegroundColor Green
    Write-Host "See log for details: $LogFile"
}
else {
    Write-Host "SYNC FAILED (Code: $ExitCode)" -ForegroundColor Red
    Write-Host "See log for details: $LogFile"
    exit $ExitCode
}
