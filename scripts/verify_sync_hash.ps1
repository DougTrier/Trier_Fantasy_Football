
$Source = "G:\Vibe Coding\TrierFantasy\src"
$Target = "R:\src"

Write-Host "Calculating Source Hash ($Source)..."
$SourceHash = Get-ChildItem -Path $Source -Recurse -File | Get-FileHash -Algorithm MD5 | Select-Object -ExpandProperty Hash
$SourceStr = $SourceHash -join ""
$SourceFinal = "MD5" + ($SourceStr | Get-FileHash -Algorithm MD5 | Select-Object -ExpandProperty Hash)

Write-Host "Calculating Target Hash ($Target)..."
$TargetHash = Get-ChildItem -Path $Target -Recurse -File | Get-FileHash -Algorithm MD5 | Select-Object -ExpandProperty Hash
$TargetStr = $TargetHash -join ""
$TargetFinal = "MD5" + ($TargetStr | Get-FileHash -Algorithm MD5 | Select-Object -ExpandProperty Hash)

Write-Host "Source: $SourceFinal"
Write-Host "Target: $TargetFinal"

if ($SourceFinal -eq $TargetFinal) {
    Write-Host "MATCH" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "MISMATCH" -ForegroundColor Red
    exit 1
}
