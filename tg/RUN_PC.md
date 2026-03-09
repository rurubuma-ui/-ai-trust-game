# Запуск на ПК (локально)

## Важно

Если бот уже запущен на VPS — останови его: `ssh root@213.108.4.68 "pm2 stop realorai-bot"`. Иначе будет ошибка 409 Conflict.

## Быстрый старт

В трёх терминалах:

```powershell
cd c:\Users\maxdz\Desktop\opensakrat\yandex2\tg

# Терминал 1 — сервер
node server/index.js

# Терминал 2 — туннель Serveo (HTTPS, без пароля)
ssh -o StrictHostKeyChecking=no -R 80:localhost:3000 serveo.net
# Скопируй URL из вывода и обнови .env: WEB_APP_URL, API_BASE, FRONTEND_URL

# Терминал 3 — бот (после обновления .env)
node bot.js
```

Или: `.\start-all.ps1` — откроет 3 окна (localtunnel).

## Ссылки

- **Бот:** https://t.me/Arboo34_bot
- **Игра:** кнопка «Играть» в боте
- **Premium:** /premium в боте или в игре (Профиль → Разработчики и правила)

## Premium подсказки

1. Открой https://t.me/Arboo34_bot
2. /start → Играть
3. В игре: Профиль → Разработчики и правила → 💡 Купить 5 подсказок
4. Или /premium в чате с ботом
