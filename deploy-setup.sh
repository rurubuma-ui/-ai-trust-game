#!/bin/bash
# Запуск на сервере после загрузки: cd /opt/realorai && bash deploy-setup.sh

set -e
cd /opt/realorai

echo "=== 1. Install Node.js, nginx, certbot ==="
command -v node >/dev/null 2>&1 || {
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
}
apt install -y nginx certbot python3-certbot-nginx 2>/dev/null || true

echo "=== 2. Create .env from template ==="
BASE_URL="https://213-108-4-68.sslip.io"
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    sed -i "s|API_BASE=.*|API_BASE=$BASE_URL|" .env
    sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=$BASE_URL|" .env
    sed -i "s|WEB_APP_URL=.*|WEB_APP_URL=$BASE_URL|" .env
  echo "INTERNAL_SECRET=$(openssl rand -hex 16)" >> .env
  echo "SERVER_URL=$BASE_URL" >> .env
    echo "Created .env from .env.example (production URLs set)"
  else
    SECRET=$(openssl rand -hex 16 2>/dev/null || echo "")
    cat > .env << ENVFILE
PORT=3000
API_BASE=$BASE_URL
FRONTEND_URL=$BASE_URL
TELEGRAM_BOT_TOKEN=REPLACE_ME
TELEGRAM_BOT_USERNAME=REPLACE_ME
WEB_APP_URL=$BASE_URL
INTERNAL_SECRET=$SECRET
SERVER_URL=$BASE_URL
ENVFILE
    echo "Created .env - fill TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME"
  fi
else
  echo ".env exists, updating production URLs"
  sed -i "s|API_BASE=.*|API_BASE=$BASE_URL|" .env
  sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=$BASE_URL|" .env
  sed -i "s|WEB_APP_URL=.*|WEB_APP_URL=$BASE_URL|" .env
  grep -q "^SERVER_URL=" .env && sed -i "s|SERVER_URL=.*|SERVER_URL=$BASE_URL|" .env || echo "SERVER_URL=$BASE_URL" >> .env
  grep -q "^INTERNAL_SECRET=" .env || echo "INTERNAL_SECRET=$(openssl rand -hex 16)" >> .env
fi

echo "=== 2.1 Validate .env ==="
get_var() { grep -E "^${1}=" .env 2>/dev/null | cut -d= -f2- | tr -d '"' | head -1; }
TOKEN=$(get_var TELEGRAM_BOT_TOKEN)
USERNAME=$(get_var TELEGRAM_BOT_USERNAME)
MISSING=""
[ -z "$TOKEN" ] || [ "$TOKEN" = "REPLACE_ME" ] || [ "$TOKEN" = "123456:ABC..." ] && MISSING="${MISSING}TELEGRAM_BOT_TOKEN "
[ -z "$USERNAME" ] || [ "$USERNAME" = "REPLACE_ME" ] || [ "$USERNAME" = "YourBotName" ] && MISSING="${MISSING}TELEGRAM_BOT_USERNAME "
if [ -n "$MISSING" ]; then
  echo ""
  echo "ERROR: Required variables not set in .env: $MISSING"
  echo ""
  echo "Edit /opt/realorai/.env and set:"
  echo "  TELEGRAM_BOT_TOKEN  - from @BotFather"
  echo "  TELEGRAM_BOT_USERNAME - bot username without @"
  echo ""
  echo "Then run: ./deploy-setup.sh"
  exit 1
fi
echo "Env OK: TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME set"

echo "=== 3. npm install ==="
npm install

echo "=== 4. Start server with PM2 ==="
npm install -g pm2 2>/dev/null || true
pm2 delete realorai 2>/dev/null || true
pm2 start tg/server/index.js --name realorai
pm2 save
pm2 startup | tail -1

echo "=== 5. Nginx config ==="
cat > /etc/nginx/sites-available/realorai << 'NGINX'
server {
    listen 80;
    server_name 213-108-4-68.sslip.io;
    root /opt/realorai/tg/client;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /auth/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /images/ {
        proxy_pass http://127.0.0.1:3000;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

ln -sf /etc/nginx/sites-available/realorai /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
# Certbot - нужен HTTPS для Telegram Web App
# Если не сработает: certbot --nginx -d 213-108-4-68.sslip.io (введёт email интерактивно)
certbot --nginx -d 213-108-4-68.sslip.io --non-interactive --agree-tos --register-unsafely-without-email 2>/dev/null || certbot --nginx -d 213-108-4-68.sslip.io
systemctl reload nginx

echo "=== 6. Telegram bot ==="
cd /opt/realorai/tg
npm install
cp ../.env .env 2>/dev/null || true
pm2 delete realorai-bot 2>/dev/null || true
pm2 start bot.js --name realorai-bot --cwd /opt/realorai/tg --max-memory-restart 80M
pm2 save

echo ""
echo "=== DONE ==="
echo "Game: https://213-108-4-68.sslip.io"
echo "API:  https://213-108-4-68.sslip.io/api/questions/single"
echo ""
echo "BotFather: /setdomain -> 213-108-4-68.sslip.io"
echo "Check TELEGRAM_BOT_USERNAME in .env (from @BotFather)"
