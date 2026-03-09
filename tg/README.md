# 🎮 Нейросеть или реальность? - Telegram версия

Версия игры для Telegram Web App.

## 📋 Особенности

- ✅ Адаптировано для Telegram Web App
- ✅ Использует Telegram CloudStorage для сохранения данных
- ✅ Автоматически берет имя пользователя из Telegram
- ✅ Без зависимости от Яндекс Игр SDK

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
cd tg
npm install
```

### 2. Запуск сервера

```bash
npm run dev:server
```

Сервер запустится на `http://localhost:3000`

### 3. Запуск клиента (для разработки)

```bash
npm run dev:client
```

Клиент запустится на `http://localhost:4173`

Или запустить оба сразу:

```bash
npm run dev
```

## 🔧 Настройка для Telegram бота

### 1. Создание Telegram бота

1. Откройте [@BotFather](https://t.me/botfather) в Telegram
2. Создайте нового бота: `/newbot`
3. Сохраните токен бота

### 2. Настройка Web App

1. Отправьте команду `/newapp` боту BotFather
2. Выберите вашего бота
3. Укажите название приложения
4. Укажите описание
5. Загрузите иконку (512x512px)
6. Укажите URL вашего веб-приложения:
   ```
   https://your-domain.com/client/
   ```
   или для разработки (через ngrok):
   ```
   https://your-ngrok-url.ngrok.io/client/
   ```

### 3. Настройка сервера

Обновите `API_BASE` в `client/main.js`:

```javascript
const API_BASE = 
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://api.your-domain.com'; // ← Ваш production домен
```

### 4. CORS настройки

Сервер уже настроен для работы с Telegram доменами. Если нужно добавить дополнительные домены, обновите `ALLOWED_ORIGINS` в `.env`:

```env
ALLOWED_ORIGINS=https://web.telegram.org,https://telegram.org,https://your-domain.com
```

### Premium подсказки (Stars)

Для работы подсказок бот и сервер должны использовать общий секрет:

```env
INTERNAL_SECRET=ваш-секретный-ключ
SERVER_URL=https://api.your-domain.com   # URL сервера для бота
```

## 📱 Использование в боте

### Базовый пример бота (Node.js)

```javascript
const TelegramBot = require('node-telegram-bot-api');
const token = 'YOUR_BOT_TOKEN';

const bot = new TelegramBot(token, {polling: true});

// Кнопка для запуска игры
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, 'Добро пожаловать в игру!', {
    reply_markup: {
      inline_keyboard: [[
        {
          text: '🎮 Начать игру',
          web_app: { url: 'https://your-domain.com/client/' }
        }
      ]]
    }
  });
});
```

### Альтернативный способ (кнопка меню)

```javascript
bot.setMyCommands([
  { command: 'start', description: 'Начать игру' }
]);

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, 'Нажмите кнопку ниже для запуска игры:', {
    reply_markup: {
      keyboard: [[
        {
          text: '🎮 Играть',
          web_app: { url: 'https://your-domain.com/client/' }
        }
      ]],
      resize_keyboard: true
    }
  });
});
```

## 🌐 Деплой

### 1. Деплой backend сервера

См. `../ARCHITECTURE_DETAILED.md` для инструкций по деплою.

### 2. Деплой клиента

Загрузите содержимое папки `client/` на ваш веб-сервер или CDN.

**Важно:** Файлы должны быть доступны по HTTPS!

### 3. Для разработки (локальный доступ)

Используйте [ngrok](https://ngrok.com/) для создания туннеля:

```bash
ngrok http 4173
```

Используйте полученный URL в настройках Web App в BotFather.

## 🔐 Безопасность

### Проверка initData (опционально)

Telegram отправляет `initData` для проверки подлинности. Вы можете проверять его на сервере:

```javascript
const crypto = require('crypto');

function validateTelegramWebAppData(initData, botToken) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');
  
  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  return calculatedHash === hash;
}
```

## 📊 API Endpoints

Все API endpoints остаются теми же, что и в основной версии:

- `GET /api/questions/single` - получить вопрос
- `POST /api/questions/single/:questionId/answer` - отправить ответ
- `WS /ws` - WebSocket для multiplayer

## 🔄 Отличия от версии для Яндекс Игр

1. **Нет YaGames SDK** - используется Telegram Web App API
2. **Сохранение данных** - через Telegram CloudStorage (fallback на localStorage)
3. **Имя пользователя** - автоматически берется из Telegram профиля
4. **CORS** - настроен для Telegram доменов

## 📝 Переменные окружения

Создайте `.env` файл:

```env
PORT=3000
ALLOWED_ORIGINS=https://web.telegram.org,https://telegram.org
```

## 🐛 Отладка

### Локальная разработка

1. Запустите сервер: `npm run dev:server`
2. Запустите ngrok: `ngrok http 4173`
3. Обновите URL в BotFather на ngrok URL
4. Откройте бота в Telegram и нажмите кнопку игры

### Консоль разработчика

В Telegram Desktop можно открыть DevTools:
- Нажмите `Ctrl+Shift+I` или `Cmd+Option+I`
- Перейдите на вкладку Console для отладки

## 📚 Дополнительные ресурсы

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Web App API](https://core.telegram.org/bots/webapps)
- [BotFather документация](https://core.telegram.org/bots/tools#botfather)

## ✅ Чек-лист перед публикацией

- [ ] Backend сервер развернут и доступен по HTTPS
- [ ] Клиент загружен на веб-сервер
- [ ] API_BASE обновлен в `client/main.js`
- [ ] CORS настроен правильно
- [ ] Web App настроен в BotFather
- [ ] Бот протестирован в Telegram
- [ ] CloudStorage работает (или используется localStorage fallback)

---

## 💡 Premium

- **Бот:** https://t.me/Arboo34_bot
- **От 1 Star:** подсказки, пропуск, страховка, поддержка
- **Inline:** в BotFather выполни `/setinline` — тогда @Arboo34_bot в любом чате покажет ссылку на игру
- **TON:** `UQCKLUHkp30qHPtId3q0E80cS4vhTWknJB4ue2nsAolW78sf`

---

**Готово к использованию!** 🎉





