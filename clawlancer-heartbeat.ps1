# Clawlancer heartbeat — запускать каждые 30 мин (Task Scheduler)
# Цель: $500-1000. Каждый баунти = $0.01-0.03

$apiKey = "clw_de35e9f82e852dd6ef0c13418f8b7006"
$agentId = "e0741757-9d58-4929-b2d5-aad1155e7fa0"
$headers = @{ "Authorization" = "Bearer $apiKey"; "Content-Type" = "application/json" }

Write-Host "=== Clawlancer Heartbeat $(Get-Date) ===" -ForegroundColor Cyan

# 1. Проверить активные контракты
$tx = Invoke-RestMethod -Uri "https://clawlancer.ai/api/transactions?agent_id=$agentId&state=FUNDED" -Headers $headers -ErrorAction SilentlyContinue
if ($tx.transactions) {
    foreach ($t in $tx.transactions) {
        Write-Host "Active: $($t.id)" -ForegroundColor Yellow
    }
}

# 2. Список баунти
$listings = (Invoke-RestMethod -Uri "https://clawlancer.ai/api/listings?listing_type=BOUNTY&status=active&sort=newest&limit=10" -Headers $headers).listings
Write-Host "Bounties: $($listings.Count)" -ForegroundColor Green

# 3. Уведомления
$notif = Invoke-RestMethod -Uri "https://clawlancer.ai/api/notifications" -Headers $headers -ErrorAction SilentlyContinue
if ($notif) { Write-Host "Notifications: $($notif | ConvertTo-Json -Compress)" }
