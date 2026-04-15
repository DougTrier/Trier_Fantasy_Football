
# PC-B Alignment Script
# Run as Administrator

$ErrorActionPreference = "Stop"

function Assert-Admin {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Error "Please run this script as Administrator."
        exit 1
    }
}

Assert-Admin

Write-Host ">>> Starting PC-B Environment Alignment..." -ForegroundColor Cyan

# 1. Install VS Build Tools (Prerequisite for Rust)
Write-Host "`n[1/5] Installing Visual Studio Build Tools 2022..." -ForegroundColor Yellow
if (-not (Get-Command vswhere -ErrorAction SilentlyContinue)) {
    # Using Winget for VS Build Tools
    # Includes C++ Tools and Windows 11 SDK (covers standard Tauri reqs)
    winget install --id Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --includeRecommended --passive --norestart"
}
else {
    Write-Host "VS Build Tools likely installed (vswhere found). Skipping."
}

# 2. Install Git
Write-Host "`n[2/5] Checking Git..." -ForegroundColor Yellow
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Git..."
    winget install --id Git.Git -e --source winget
    $env:Path = "$env:Path;C:\Program Files\Git\cmd"
}
else {
    Write-Host "Git is already installed."
}

# 3. Install Node.js v22.17.1
Write-Host "`n[3/5] Installing Node.js v22.17.1..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    # Using NVM for precise version control
    Write-Host "Installing NVM for Windows..."
    winget install --id CoreyButler.NVMforWindows -e --source winget
    
    # Reload env to get NVM
    $env:NVM_HOME = "$env:ProgramData\nvm"
    $env:NVM_SYMLINK = "C:\Program Files\nodejs"
    $env:Path = "$env:NVM_HOME;$env:NVM_SYMLINK;$env:Path"
    
    Write-Host "Installing Node v22.17.1..."
    nvm install 22.17.1
    nvm use 22.17.1
}
else {
    $v = node -v
    if ($v -ne "v22.17.1") {
        Write-Warning "Node installed but version is $v. Manual alignment recommended (Target: v22.17.1)."
    }
    else {
        Write-Host "Node is aligned ($v)."
    }
}

# 4. Install Rust 1.93.0
Write-Host "`n[4/5] Installing Rust Toolchain 1.93.0..." -ForegroundColor Yellow
if (-not (Get-Command rustup -ErrorAction SilentlyContinue)) {
    # Download Rustup
    Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile "rustup-init.exe"
    # Install default stable 
    Start-Process -FilePath ".\rustup-init.exe" -ArgumentList "-y --default-toolchain 1.93.0" -Wait -NoNewWindow
    Remove-Item "rustup-init.exe"
    
    $env:Path = "$env:Path;$env:USERPROFILE\.cargo\bin"
}
else {
    Write-Host "Rustup found. Installing 1.93.0 toolchain..."
    rustup install 1.93.0
    rustup default 1.93.0
}
# Install targets
rustup target add x86_64-pc-windows-msvc

# 5. Project Setup Helper
Write-Host "`n[5/5] Project Setup" -ForegroundColor Yellow
if (-not (Test-Path "G:\Vibe Coding")) {
    New-Item -ItemType Directory -Path "G:\Vibe Coding" -Force
}

$repoPath = "G:\Vibe Coding\TrierFantasy"
if (-not (Test-Path $repoPath)) {
    Write-Host "Repository missing."
    Write-Host "Run: git clone <YOUR_REPO_URL> '$repoPath'" -ForegroundColor Magenta
}
else {
    Write-Host "Repository exists at $repoPath."
}

Write-Host "`n>>> Alignment Script Complete. Please restart your terminal." -ForegroundColor Green
Write-Host "Run verification commands:"
Write-Host "  node -v  (Expect v22.17.1)"
Write-Host "  rustc -V (Expect 1.93.0)"
