<#
.SYNOPSIS
    Watches local source folders for changes and triggers sync_to_pcb.ps1.
    Implements debounce to prevent rapid-fire syncs.

.DESCRIPTION
    Monitors: src\, src-tauri\, scripts\ and root config files.
    Triggers: scripts\sync_to_pcb.ps1
    Debounce: 2 Seconds.

.USAGE
    .\watch_sync_to_pcb.ps1
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SyncScript = "$ScriptDir\sync_to_pcb.ps1"
$SourceDir = Resolve-Path "$ScriptDir\.."

Write-Host "Starting PC-A -> PC-B Sync Watcher..." -ForegroundColor Cyan
Write-Host "Watching: $SourceDir"

# Configuration
$DebounceSeconds = 2
$LastChangeTime = [DateTime]::MinValue
$SyncPending = $false
$Timer = $null

# Define what to watch
$Watchers = @()
$FoldersToWatch = @("src", "src-tauri", "scripts")
$Filter = "*.*" # Watch all files in these folders

# Action block for events
$Action = {
    $Global:LastChangeTime = [DateTime]::Now
    $Global:SyncPending = $true
    
    # Reset Timer
    if ($Global:Timer) { $Global:Timer.Stop(); $Global:Timer.Close() }
    
    $Global:Timer = New-Object System.Timers.Timer
    $Global:Timer.Interval = ($Global:DebounceSeconds * 1000)
    $Global:Timer.AutoReset = $false
    
    # Timer Event - This runs on a separate thread, so use Job or simple invocation
    # PowerShell event integration with Timers is tricky. 
    # Simplified approach: We just set a flag and loop in the main thread.
}

# Create Watchers
foreach ($folder in $FoldersToWatch) {
    $Path = "$SourceDir\$folder"
    if (Test-Path $Path) {
        $Watcher = New-Object System.IO.FileSystemWatcher
        $Watcher.Path = $Path
        $Watcher.IncludeSubdirectories = $true
        $Watcher.EnableRaisingEvents = $true
        $Watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::FileName -bor [System.IO.NotifyFilters]::DirectoryName
        
        # Subscribe to events
        Register-ObjectEvent $Watcher "Changed" -Action $Action | Out-Null
        Register-ObjectEvent $Watcher "Created" -Action $Action | Out-Null
        Register-ObjectEvent $Watcher "Deleted" -Action $Action | Out-Null
        Register-ObjectEvent $Watcher "Renamed" -Action $Action | Out-Null
        
        $Watchers += $Watcher
        Write-Host "Watching: $folder" -ForegroundColor Gray
    }
}

# Also watch root package.json
$RootWatcher = New-Object System.IO.FileSystemWatcher
$RootWatcher.Path = $SourceDir
$RootWatcher.Filter = "package.json"
$RootWatcher.EnableRaisingEvents = $true
Register-ObjectEvent $RootWatcher "Changed" -Action $Action | Out-Null
$Watchers += $RootWatcher

Write-Host "Watcher Active. Press Ctrl+C to stop." -ForegroundColor Green

# Main Loop
try {
    while ($true) {
        Start-Sleep -Milliseconds 500
        
        if ($Global:SyncPending) {
            $TimeSinceChange = ([DateTime]::Now - $Global:LastChangeTime).TotalSeconds
            
            if ($TimeSinceChange -ge $DebounceSeconds) {
                $Global:SyncPending = $false
                Write-Host "Change detected. Triggering Sync..." -ForegroundColor Yellow
                
                # Run Sync Script (Blocking)
                try {
                    & $SyncScript
                }
                catch {
                    Write-Error "Sync execution failed: $_"
                }
                
                Write-Host "Sync Done. Resuming Watch..." -ForegroundColor Green
            }
        }
    }
}
finally {
    # Cleanup
    foreach ($w in $Watchers) { $w.Dispose() }
    Unregister-Event -SourceIdentifier "*"
}
