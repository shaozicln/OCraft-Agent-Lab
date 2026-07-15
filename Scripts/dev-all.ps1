# Start dev services in three terminals.
# - External CMD/PowerShell: opens 3 separate PowerShell windows (reliable).
# - Cursor/VS Code integrated terminal: cannot spawn IDE panels from npm;
#   use Ctrl+Shift+B instead (runs dev:all in 3 dedicated integrated terminals).
$Root = Split-Path -Parent $PSScriptRoot

function Test-IdeIntegratedTerminal {
    return $env:TERM_PROGRAM -eq 'vscode' -or [bool]$env:VSCODE_IPC_HOOK_CLI
}

function Start-DevWindow {
    param(
        [string]$Title,
        [string]$WorkingDir,
        [string]$Command
    )

    $launch = "Set-Location '$WorkingDir'; Write-Host '[$Title]' -ForegroundColor Cyan; $Command"
    Start-Process powershell -ArgumentList '-NoExit', '-Command', $launch
}

if (Test-IdeIntegratedTerminal) {
    Write-Host ''
    Write-Host 'Detected Cursor/VS Code integrated terminal.' -ForegroundColor Cyan
    Write-Host 'npm cannot auto-open new IDE terminal panels from a shell script.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'Use one of these instead:' -ForegroundColor Green
    Write-Host '  Ctrl+Shift+B          -> start dev:all (3 integrated terminals)' -ForegroundColor White
    Write-Host '  Ctrl+Shift+P          -> Tasks: Run Task -> dev:all' -ForegroundColor White
    Write-Host ''
    exit 0
}

Write-Host 'Opening 3 external PowerShell windows...' -ForegroundColor Green
Write-Host '  1. Drizzle Studio'
Write-Host '  2. Server (NestJS :4000)'
Write-Host '  3. Client (Next.js :3300)'
Write-Host ''
Write-Host 'Tip: for Cursor built-in terminals, open this project in Cursor and press Ctrl+Shift+B.' -ForegroundColor Yellow
Write-Host ''

Start-DevWindow -Title 'db:studio' -WorkingDir (Join-Path $Root 'server') -Command 'npm run db:studio'
Start-Sleep -Milliseconds 400
Start-DevWindow -Title 'server' -WorkingDir (Join-Path $Root 'server') -Command 'npm run start:dev'
Start-Sleep -Milliseconds 400
Start-DevWindow -Title 'client' -WorkingDir (Join-Path $Root 'client') -Command 'npm run dev'

Write-Host 'Done.' -ForegroundColor Green
