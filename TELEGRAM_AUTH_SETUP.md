# Вход через Telegram

Люди могут войти в приложение через Telegram-бота.

## Два способа входа

### 1. Через бота (Telegram Web App)

Пользователь нажимает кнопку «Играть» в боте → открывается игра → **автоматический вход** по `initData` от Telegram.

### 2. Через сайт (Login Widget)

Пользователь открывает игру в браузере → в профиле нажимает «Login with Telegram» → авторизуется в Telegram → возвращается в игру с сессией.

## Настройка

### 1. Создать бота

1. Откройте [@BotFather](https://t.me/botfather)
2. `/newbot` → укажите имя и username
3. Сохраните токен

### 2. Привязать домен (для Login Widget)

Отправьте BotFather:
```
/setdomain
```
Выберите бота и укажите домен вашего сайта (например, `your-game.com`). Без этого Login Widget не сработает.

### 3. Переменные окружения

В `.env`:

```env
TELEGRAM_BOT_TOKEN=123456789:ABC...
TELEGRAM_BOT_USERNAME=YourBotName
FRONTEND_URL=https://your-game.com
API_BASE=https://api.your-game.com
```

- `TELEGRAM_BOT_TOKEN` — токен от BotFather
- `TELEGRAM_BOT_USERNAME` — username бота без @ (для Login Widget)
- `FRONTEND_URL` — URL клиента (куда редиректить после входа)
- `API_BASE` — URL API (для callback)

### 4. Web App в боте

Для входа через кнопку в боте настройте Web App в BotFather (`/newapp` или через меню) и укажите URL клиента.

## API

- `POST /auth/telegram` — вход (тело: `{ initData }` или данные Login Widget)
- `GET /auth/me` — текущий пользователь (заголовок `Authorization: Bearer <token>`)
- `GET /auth/telegram/config` — конфиг для клиента (botUsername, callbackUrl)
- `GET /auth/telegram/callback` — редирект от Login Widget

## Сессии

- Токен хранится в `localStorage` на клиенте
- Сессия действует 30 дней
- Сервер хранит сессии в памяти (для production — Redis)
