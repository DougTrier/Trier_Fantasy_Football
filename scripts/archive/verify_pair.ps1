<#
.SYNOPSIS
    Verifies coherence between PC-A and PC-B.
    Compares file hashes of critical source files.

.DESCRIPTION
    Checks: package.json, src-tauri\Cargo.toml, src\App.tsx, etc.
    Outputs: MATCH or MISMATCH for each file.

.USAGE
    .\verify_pair.ps1
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceDir = Resolve-Path "$ScriptDir\.." # Repo Root
$TargetRoot = "R:\" # PC-B Share Root

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   PC-A <-> PC-B  INTEGRITY CHECK" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

if (!(Test-Path $TargetRoot)) {
    Write-Error "CRITICAL: Target drive R:\ not found."
}

# Critical files to check
$CriticalFiles = @(
    "package.json",
    "src-tauri\Cargo.toml",
    "src-tauri\src\main.rs",
    "src\App.tsx",
    "src\services\P2PService.ts"
)

$AllMatch = $true

foreach ($relPath in $CriticalFiles) {
    $LocalPath = "$SourceDir\$relPath"
    $RemotePath = "$TargetRoot\$relPath"
    
    if (!(Test-Path $LocalPath)) {
        Write-Warning "Local file missing: $relPath (Skipping)"
        continue
    }
    
    if (!(Test-Path $RemotePath)) {
        Write-Host "[FAIL] MISSING ON TARGET: $relPath" -ForegroundColor Red
        $AllMatch = $false
        continue
    }
    
    $HashA = (Get-FileHash $LocalPath).Hash
    $HashB = (Get-FileHash $RemotePath).Hash
    
    if ($HashA -eq $HashB) {
        Write-Host "[OK]   $relPath" -ForegroundColor Green
    }
    else {
        Write-Host "[FAIL] HASH MISMATCH: $relPath" -ForegroundColor Red
        Write-Host "       Local:  $HashA"
        Write-Host "       Remote: $HashB"
        $AllMatch = $false
    }
}

Write-Host "----------------------------------------------"
if ($AllMatch) {
    Write-Host "VERIFICATION PASSED: Environments are aligned." -ForegroundColor Green
}
else {
    Write-Host "VERIFICATION FAILED: Mismatches detected." -ForegroundColor Red
    exit 1
}
