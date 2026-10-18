param (
    [string]$Target = "release"
)

$exe = if ($Target -eq "release") {
    "src-tauri\target\release\notas-fup.exe"
} else {
    "src-tauri\target\debug\notas-fup.exe"
}

if (-not (Test-Path $exe)) {
    Write-Error "Binary not found at $exe"
    exit 1
}

$fileItem = Get-Item $exe
$sizeMB = [Math]::Round($fileItem.Length / 1MB, 2)
Write-Host "Executable: $exe"
Write-Host "Binary on disk: $sizeMB MB"

$proc = Start-Process -FilePath $exe -PassThru
Start-Sleep -Seconds 3

$p = Get-Process -Id $proc.Id
$wsMB = [Math]::Round($p.WorkingSet64 / 1MB, 2)
$pmMB = [Math]::Round($p.PrivateMemorySize64 / 1MB, 2)

Write-Host "Process PID: $($p.Id)"
Write-Host "Idle Working Set (RAM): $wsMB MB"
Write-Host "Idle Private Memory: $pmMB MB"

Stop-Process -Id $proc.Id -Force
Write-Host "Measurement complete."
