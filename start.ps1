$netlify = "C:\Users\F086\AppData\Roaming\npm\netlify.cmd"
$projectDir = Join-Path $PSScriptRoot "hubdb-app"

Write-Host "Checking ports..." -ForegroundColor Yellow
@(3999, 8888) | ForEach-Object {
    $port = $_
    $result = netstat -ano | Select-String ":$port " | Select-Object -First 1
    if ($result) {
        $pid2 = ($result.ToString().Trim() -split "\s+")[-1]
        Stop-Process -Id ([int]$pid2) -Force -ErrorAction SilentlyContinue
        Write-Host "  Killed process on port $port (PID: $pid2)" -ForegroundColor Gray
    }
}
Start-Sleep 1

Write-Host "Starting Netlify Dev..." -ForegroundColor Cyan
Start-Job { Start-Sleep 12; Start-Process "http://localhost:8888/admin1.html" } | Out-Null
Set-Location $projectDir
& $netlify dev