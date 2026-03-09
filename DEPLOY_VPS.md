# Деплой на VPS без домена

**Сервер:** Ubuntu 24.04, IP `213.108.4.68`  
**HTTPS:** через sslip.io — `213-108-4-68.sslip.io` → ваш IP (бесплатно)

---

## Шаг 1: Подключение к серверу

```bash
ssh root@213.108.4.68
# Введите пароль от панели
```

---

## Шаг 2: Установка Node.js, nginx, certbot

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Nginx + Certbot
apt install -y nginx certbot python3-certbot-nginx
```

---

## Шаг 3: Клонирование и настройка проекта

```bash
cd /opt
mkdir -p realorai
cd realorai
# Загрузите файлы с ПК (PowerShell):
# scp -r c:\Users\maxdz\Desktop\opensakrat\yandex2\* root@213.108.4.68:/opt/realorai/
```

Создайте `.env` (или используйте `deploy-setup.sh` — он создаст из `.env.example`):

```bash
nano .env
```

Обязательные переменные:

```env
PORT=3000
API_BASE=https://213-108-4-68.sslip.io
FRONTEND_URL=https://213-108-4-68.sslip.io
TELEGRAM_BOT_TOKEN=...   # из @BotFather
TELEGRAM_BOT_USERNAME=... # без @
WEB_APP_URL=https://213-108-4-68.sslip.io
```

Скрипт `deploy-setup.sh` создаёт `.env` из шаблона и проверяет `TELEGRAM_BOT_TOKEN` и `TELEGRAM_BOT_USERNAME`. Если они не заданы — выведет инструкцию и завершится.

---

## Шаг 4: Запуск сервера

```bash
cd /opt/realorai
npm install
npm install -g pm2
pm2 start server/index.js --name realorai
# Сервер использует server/data — убедитесь, что папка server/data и imageManifest.json есть
pm2 save
pm2 startup
```

---

## Шаг 5: Nginx + HTTPS

```bash
nano /etc/nginx/sites-available/realorai
```

Вставьте (замените `213-108-4-68` на ваш IP в формате sslip):

```nginx
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
```

Активируйте и получите SSL:

```bash
ln -s /etc/nginx/sites-available/realorai /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
certbot --nginx -d 213-108-4-68.sslip.io
systemctl reload nginx
```

---

## Шаг 6: Telegram BotFather + бот

1. **Домен:** `/setdomain` → выберите бота → введите `213-108-4-68.sslip.io`
2. **Запуск бота** (для кнопки «Играть»):
   ```bash
   cd /opt/realorai/tg
   npm install
   cp ../.env .env
   pm2 start bot.js --name realorai-bot --cwd /opt/realorai/tg
   pm2 save
   ```

---

## Быстрая загрузка и деплой

С вашего ПК (PowerShell):

```powershell
cd c:\Users\maxdz\Desktop\opensakrat\yandex2
.\deploy-upload.ps1
```

Потом на сервере:

```bash
ssh root@213.108.4.68
cd /opt/realorai
# Если .env нет — скрипт создаст из .env.example. Заполните TELEGRAM_BOT_TOKEN и TELEGRAM_BOT_USERNAME:
nano .env
bash deploy-setup.sh
```

При первом запуске, если токен/username не заданы, скрипт выведет ошибку и инструкцию. Отредактируйте `.env` и запустите снова.

Или вручную:

```powershell
scp -r server tg client package.json package-lock.json deploy-setup.sh .env.example root@213.108.4.68:/opt/realorai/
```

---

## Проверка

- Игра: https://213-108-4-68.sslip.io
- API: https://213-108-4-68.sslip.io/api/questions/single
- Бот: отправьте `/start` → кнопка «Играть» → должна открыться игра
