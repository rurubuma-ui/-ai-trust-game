# Запуск игры на ПК для Telegram
# Запускать из папки tg: .\start-pc.ps1

$subdomain = "realorai"
$port = 3000
$url = "https://${subdomain}.loca.lt"

Write-Host "Starting server on port $port..." -ForegroundColor Cyan
Start-Process -FilePath "node" -ArgumentList "server/index.js" -WorkingDirectory $PSScriptRoot -WindowStyle Hidden

Start-Sleep -Seconds 2

Write-Host "Starting bot..." -ForegroundColor Cyan
Start-Process -FilePath "node" -ArgumentList "bot.js" -WorkingDirectory $PSScriptRoot -WindowStyle Hidden

Start-Sleep -Seconds 2

Write-Host "Starting tunnel $url ..." -ForegroundColor Cyan
# Update .env
$envContent = Get-Content "$PSScriptRoot\.env" -Raw
$envContent = $envContent -replace "WEB_APP_URL=.*", "WEB_APP_URL=$url"
$envContent = $envContent -replace "API_BASE=.*", "API_BASE=$url"
$envContent = $envContent -replace "FRONTEND_URL=.*", "FRONTEND_URL=$url"
Set-Content "$PSScriptRoot\.env" $envContent

Start-Process -FilePath "npx" -ArgumentList "--yes", "localtunnel", "--port", $port, "--subdomain", $subdomain -WorkingDirectory $PSScriptRoot -NoNewWindow

Write-Host ""
Write-Host "Game URL: $url" -ForegroundColor Green
Write-Host "Open bot in Telegram, send /start, click Play" -ForegroundColor Green
Write-Host "Donate: /donate in bot" -ForegroundColor Green
