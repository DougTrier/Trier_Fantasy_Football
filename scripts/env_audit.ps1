
$ErrorActionPreference = "Continue"

function Get-CommandVersion {
    param($Cmd, $Args = "--version")
    try {
        # Try direct execution (PowerShell)
        $output = & $Cmd $Args 2>&1
        if ($LASTEXITCODE -eq 0) { return $output | Select-Object -First 1 }
    }
    catch {
        # Fallback to CMD if PowerShell alias check fails
        try {
            $output = cmd /c "$Cmd $Args" 2>&1
            if ($LASTEXITCODE -eq 0) { return $output | Select-Object -First 1 }
        }
        catch {}
    }
    return "Not Found"
}

function Write-Section {
    param($Title)
    Write-Output "`n========================================================"
    Write-Output " $Title"
    Write-Output "========================================================"
}

$LogPath = "PC-A_Audit.txt"
if ($args[0]) { $LogPath = $args[0] }

Start-Transcript -Path $LogPath -Force

Write-Section "SYSTEM INFORMATION"
Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion, OsBuildNumber, OsArchitecture | Format-List
Write-Output "Host Name: $env:COMPUTERNAME"

Write-Section "NODE.JS ENVIRONMENT"
Write-Output "Node Version: $(Get-CommandVersion node -v)"
Write-Output "NPM Version:  $(Get-CommandVersion npm -v)"
Write-Output "PNPM Version: $(Get-CommandVersion pnpm -v)"
Write-Output "Yarn Version: $(Get-CommandVersion yarn -v)"

Write-Section "RUST TOOLCHAIN"
Write-Output "Rustc: $(Get-CommandVersion rustc -V)"
Write-Output "Cargo: $(Get-CommandVersion cargo -V)"
if (Get-Command rustup -ErrorAction SilentlyContinue) {
    Write-Output "`n--- Rustup Toolchains ---"
    cmd /c "rustup toolchain list"
    Write-Output "`n--- Rustup Targets ---"
    cmd /c "rustup target list --installed"
}
else {
    Write-Output "Rustup not found."
}

Write-Section "TAURI CLI"
# Try npx tauri info which gives rich info
if (Test-Path "package.json") {
    Write-Output "Running 'npx tauri info'..."
    try {
        $tauriInfo = cmd /c "npx tauri info" 2>&1
        $tauriInfo
    }
    catch {
        Write-Output "Failed to run npx tauri info."
    }
}
Write-Output "Global Tauri CLI: $(Get-CommandVersion tauri --version)"


Write-Section "BUILD TOOLS & RUNTIMES"
Write-Output "Git Version: $(Get-CommandVersion git --version)"
Write-Output "Python: $(Get-CommandVersion python --version)"

Write-Output "`n--- Visual Studio Build Tools (vswhere) ---"
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
    & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
}
else {
    Write-Output "vswhere.exe not found."
}

Write-Output "`n--- WebView2 Runtime ---"
try {
    $wv2 = Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue
    if ($wv2) { Write-Output "WebView2 Version: $($wv2.pv)" } else { Write-Output "WebView2 Registry Key not found." }
}
catch {
    Write-Output "Failed to query WebView2 registry."
}

Write-Section "PROJECT DEPENDENCIES & CHECKS"
if (Test-Path "package-lock.json") {
    $hash = Get-FileHash "package-lock.json"
    Write-Output "package-lock.json SHA256: $($hash.Hash)"
}
else {
    Write-Output "package-lock.json: MISSING"
}

if (Test-Path "package.json") {
    $pkg = Get-Content "package.json" | ConvertFrom-Json
    Write-Output "Package Name: $($pkg.name)"
    if ($pkg.engines) {
        Write-Output "Engines Requirement: $($pkg.engines | ConvertTo-Json -Compress)"
    }
}

Write-Section "ENVIRONMENT VARIABLES"
if ($env:OPENAI_API_KEY) {
    Write-Output "OPENAI_API_KEY: Present (First 4 chars: $($env:OPENAI_API_KEY.Substring(0,4))...)"
}
else {
    Write-Output "OPENAI_API_KEY: MISSING"
}

Stop-Transcript
Write-Output "`nAudit Saved to $LogPath"
