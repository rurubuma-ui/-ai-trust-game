# Деплой на Railway (без VPS)

1. Зайди на [railway.app](https://railway.app), войди через GitHub.
2. **New Project** → **Deploy from GitHub repo** → выбери репозиторий (или загрузи код).
3. Railway сам определит Node.js и запустит `npm start`.
4. **Variables** — добавь переменные окружения:

```
TELEGRAM_BOT_TOKEN=8593766122:AAHoPpGqQUXkmzrcWJ4xf4_5nkVDKR8iDZg
TELEGRAM_BOT_USERNAME=Arboo34_bot
WEB_APP_URL=https://ТВОЙ-ПРОЕКТ.up.railway.app
API_BASE=https://ТВОЙ-ПРОЕКТ.up.railway.app
FRONTEND_URL=https://ТВОЙ-ПРОЕКТ.up.railway.app
SERVER_URL=https://ТВОЙ-ПРОЕКТ.up.railway.app
INTERNAL_SECRET=любая-случайная-строка-32-символа
```

5. После деплоя скопируй URL (например `xxx.up.railway.app`) и обнови `WEB_APP_URL`, `API_BASE`, `FRONTEND_URL`, `SERVER_URL`.
6. В BotFather: `/setdomain` → `xxx.up.railway.app`.

**Бесплатно:** ~$5 кредитов в месяц. Бот + сервер работают в одном процессе.
