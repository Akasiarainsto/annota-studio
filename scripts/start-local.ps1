param([switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$taskNode = Get-Command node -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source
if (-not $taskNode) {
    $taskNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if (-not (Test-Path -LiteralPath $taskNode)) {
    throw 'Node.js 24+ is required. Install Node.js 24, then run this launcher again.'
}
$taskVersion = & $taskNode --version
if ([int]($taskVersion.TrimStart('v').Split('.')[0]) -lt 24) { throw 'Please use Node.js 24 or newer.' }
$taskStorage = Join-Path $taskRoot '.local_data'
New-Item -ItemType Directory -Path $taskStorage -Force | Out-Null
$taskPort = 8788
while ($taskPort -lt 8799) {
    $taskHealth = $null
    try { $taskHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$taskPort/health" -TimeoutSec 1 } catch { $taskHealth = $null }
    if ($taskHealth -and $taskHealth.workspace -eq $taskRoot) { break }
    $taskListener = Get-NetTCPConnection -LocalPort $taskPort -State Listen -ErrorAction SilentlyContinue
    if (-not $taskListener) { break }
    $taskPort++
}
if ($taskPort -ge 8799) { throw 'Local demo ports 8788-8798 are in use.' }
if (-not $taskHealth -or $taskHealth.workspace -ne $taskRoot) {
    $env:PORT = [string]$taskPort
    $taskEntry = Join-Path $taskRoot 'server\index.js'
    $taskProcess = Start-Process -FilePath $taskNode -ArgumentList @('"' + $taskEntry + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskStorage 'service.log') -RedirectStandardError (Join-Path $taskStorage 'service-error.log') -PassThru
    Set-Content -LiteralPath (Join-Path $taskStorage 'service.pid') -Value $taskProcess.Id -Encoding Ascii
    for ($taskAttempt = 0; $taskAttempt -lt 40; $taskAttempt++) {
        Start-Sleep -Milliseconds 200
        try { $taskHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$taskPort/health" -TimeoutSec 1 } catch { $taskHealth = $null }
        if ($taskHealth -and $taskHealth.workspace -eq $taskRoot) { break }
    }
    if (-not $taskHealth) { throw "Startup failed. Read $taskStorage\service-error.log" }
}
$taskUrl = "http://127.0.0.1:$taskPort/"
Set-Content -LiteralPath (Join-Path $taskStorage 'local-url.txt') -Value $taskUrl -Encoding Ascii
Write-Output $taskUrl
if (-not $NoOpen) { Start-Process $taskUrl }
