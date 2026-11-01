$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$taskPidFile = Join-Path $taskRoot '.local_data\service.pid'
if (-not (Test-Path -LiteralPath $taskPidFile)) { Write-Output 'No launcher-owned service is recorded.'; exit }
$taskPid = [int](Get-Content -LiteralPath $taskPidFile -Raw)
$taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskPid" -ErrorAction SilentlyContinue
$taskEntry = Join-Path $taskRoot 'server\index.js'
if ($taskProcess -and $taskProcess.Name -eq 'node.exe' -and $taskProcess.CommandLine.Contains($taskEntry)) {
    Stop-Process -Id $taskPid
    Write-Output 'Local service stopped. SQLite data is preserved.'
} elseif ($taskProcess) {
    throw 'The recorded PID belongs to a different process; it was not stopped.'
}
Remove-Item -LiteralPath $taskPidFile
