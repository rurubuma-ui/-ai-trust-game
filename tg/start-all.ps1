# Запуск игры на ПК — всё в одном
# Запускать из папки tg: .\start-all.ps1

$tgDir = $PSScriptRoot
$subdomain = "realorai-pc"
$url = "https://${subdomain}.loca.lt"

# Обновить .env
$envPath = Join-Path $tgDir ".env"
(Get-Content $envPath) -replace "WEB_APP_URL=.*", "WEB_APP_URL=$url" -replace "API_BASE=.*", "API_BASE=$url" -replace "FRONTEND_URL=.*", "FRONTEND_URL=$url" | Set-Content $envPath

Write-Host "=== AI Trust Experiment — запуск на ПК ===" -ForegroundColor Cyan
Write-Host ""

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$tgDir'; Write-Host 'Server' -ForegroundColor Green; node server/index.js"
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$tgDir'; Write-Host 'Tunnel' -ForegroundColor Green; npx --yes localtunnel --port 3000 --subdomain $subdomain"
Start-Sleep -Seconds 5

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$tgDir'; Write-Host 'Bot' -ForegroundColor Green; node bot.js"

Write-Host "Открыто 3 окна: Server, Tunnel, Bot" -ForegroundColor Green
Write-Host ""
Write-Host "Бот: https://t.me/Arboo34_bot" -ForegroundColor White
Write-Host "Донат: /donate в боте" -ForegroundColor White
