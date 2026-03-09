# Загрузка игры на VPS 213.108.4.68
# Запуск из папки yandex2: .\deploy-upload.ps1
# Потребуется пароль root при запросе
# node_modules не загружаются — на сервере выполняется npm install

$server = "root@213.108.4.68"
$remotePath = "/opt/realorai"

Write-Host "Uploading to $server`:$remotePath (excluding node_modules) ..." -ForegroundColor Cyan

# Создаём папку (введите пароль root при запросе)
ssh -o StrictHostKeyChecking=no $server "mkdir -p $remotePath"

# Архив без node_modules — быстрее и надёжнее, чем scp тысячи файлов
$archive = "deploy.tar"
if (Get-Command tar -ErrorAction SilentlyContinue) {
  tar --exclude='node_modules' -cf $archive server tg client package.json package-lock.json deploy-setup.sh .env.example 2>$null
  if (Test-Path $archive) {
    scp -o StrictHostKeyChecking=no $archive ${server}:$remotePath/
    if (Test-Path "tg\.env") { scp -o StrictHostKeyChecking=no tg\.env ${server}:${remotePath}/.env }
    ssh -o StrictHostKeyChecking=no $server "cd $remotePath && tar -xf $archive && rm $archive && bash deploy-setup.sh"
    Remove-Item $archive -Force -ErrorAction SilentlyContinue
    Write-Host "Done. Game: https://213-108-4-68.sslip.io" -ForegroundColor Green
  } else {
    Write-Host "tar failed, falling back to scp (will upload node_modules - slower)" -ForegroundColor Yellow
    scp -o StrictHostKeyChecking=no -r server tg client package.json package-lock.json deploy-setup.sh .env.example ${server}:$remotePath/
    if (Test-Path "tg\.env") { scp -o StrictHostKeyChecking=no tg\.env ${server}:${remotePath}/.env }
    ssh -o StrictHostKeyChecking=no $server "cd $remotePath && bash deploy-setup.sh"
    Write-Host "Done. Game: https://213-108-4-68.sslip.io" -ForegroundColor Green
  }
} else {
  Write-Host "tar not found, using scp (will upload node_modules - may be slow)" -ForegroundColor Yellow
  scp -o StrictHostKeyChecking=no -r server tg client package.json package-lock.json deploy-setup.sh .env.example ${server}:$remotePath/
  if (Test-Path "tg\.env") { scp -o StrictHostKeyChecking=no tg\.env ${server}:${remotePath}/.env }
  ssh -o StrictHostKeyChecking=no $server "cd $remotePath && bash deploy-setup.sh"
  Write-Host "Done. Game: https://213-108-4-68.sslip.io" -ForegroundColor Green
}
