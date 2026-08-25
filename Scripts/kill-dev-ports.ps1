# Free dev ports and Next.js dev lock before dev:all restarts services.
$Root = Split-Path -Parent $PSScriptRoot
# client Next=3300 · Nest=4400 · drizzle studio 常见 4983；顺带清旧 3000/3010/4000
$ports = @(3000, 3010, 3300, 4000, 4400, 4983)

Write-Host 'Preparing dev environment...' -ForegroundColor Cyan

foreach ($port in $ports) {
    $lines = netstat -ano | Select-String "LISTENING" | Select-String ":$port\s"
    foreach ($line in $lines) {
        if ($line -match '\s(\d+)\s*$') {
            $procId = $Matches[1]
            if ($procId -eq '0') { continue }
            Write-Host "Stopping PID $procId (port $port)" -ForegroundColor Yellow
            taskkill /PID $procId /F 2>$null | Out-Null
        }
    }
}

$nextLock = Join-Path $Root 'client\.next\dev\lock'
if (Test-Path $nextLock) {
    Remove-Item $nextLock -Force
    Write-Host 'Removed Next.js dev lock file' -ForegroundColor Yellow
}

Write-Host 'Dev ports cleared.' -ForegroundColor Green

Write-Host 'Building @ocraft/shared...' -ForegroundColor Cyan
Push-Location (Join-Path $Root 'packages\shared')
npm run build
Pop-Location
Write-Host 'Prep done.' -ForegroundColor Green
