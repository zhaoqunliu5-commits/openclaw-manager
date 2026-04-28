param(
  [Parameter(Position=0)]
  [ValidateSet('dev', 'build', 'start', 'stop', 'restart', 'status', 'logs')]
  [string]$Action = 'dev'
)

$ProjectRoot = $PSScriptRoot

function Start-Dev {
  Write-Host "Starting development servers..." -ForegroundColor Cyan
  Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force 2>$null
  Start-Sleep 1

  Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory "$ProjectRoot\backend" -NoNewWindow
  Start-Sleep 3
  Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory "$ProjectRoot\frontend" -NoNewWindow

  Write-Host ""
  Write-Host "Frontend: http://localhost:5173/" -ForegroundColor Green
  Write-Host "Backend:  http://localhost:3002/" -ForegroundColor Green
  Write-Host "Health:   http://localhost:3002/health" -ForegroundColor Green
}

function Build-All {
  Write-Host "Building backend..." -ForegroundColor Cyan
  Push-Location "$ProjectRoot\backend"
  npm run build
  Pop-Location

  Write-Host "Building frontend..." -ForegroundColor Cyan
  Push-Location "$ProjectRoot\frontend"
  npm run build
  Pop-Location

  Write-Host "Build complete!" -ForegroundColor Green
}

function Start-Prod {
  Write-Host "Starting production server with PM2..." -ForegroundColor Cyan
  if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
    Write-Host "PM2 not found. Installing..." -ForegroundColor Yellow
    npm install -g pm2
  }

  if (-not (Test-Path "$ProjectRoot\frontend\dist")) {
    Write-Host "Frontend not built. Building..." -ForegroundColor Yellow
    Build-All
  }

  Push-Location $ProjectRoot
  pm2 start ecosystem.config.json
  Pop-Location

  Write-Host ""
  Write-Host "Production server: http://localhost:3002/" -ForegroundColor Green
  pm2 status
}

function Stop-Prod {
  Write-Host "Stopping production server..." -ForegroundColor Cyan
  Push-Location $ProjectRoot
  pm2 stop ecosystem.config.json
  Pop-Location
}

function Restart-Prod {
  Write-Host "Restarting production server..." -ForegroundColor Cyan
  Push-Location $ProjectRoot
  pm2 restart ecosystem.config.json
  Pop-Location
}

function Show-Status {
  pm2 status
}

function Show-Logs {
  pm2 logs openclaw-manager-api
}

switch ($Action) {
  'dev'     { Start-Dev }
  'build'   { Build-All }
  'start'   { Start-Prod }
  'stop'    { Stop-Prod }
  'restart' { Restart-Prod }
  'status'  { Show-Status }
  'logs'    { Show-Logs }
}
