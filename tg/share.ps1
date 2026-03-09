# Copy share message and open bot
$msg = "Game: https://t.me/Arboo34_bot | Premium: /premium"
Set-Clipboard -Value $msg
Write-Host "Copied to clipboard:" -ForegroundColor Green
Write-Host $msg
Start-Process 'https://t.me/Arboo34_bot'
