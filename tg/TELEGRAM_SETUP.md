# 📱 Настройка игры для Telegram

## 🎯 Быстрая настройка

### 1. Создание бота через BotFather

1. Откройте [@BotFather](https://t.me/botfather) в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям:
   - Укажите имя бота (например: "Игра Нейросеть или реальность")
   - Укажите username бота (например: `your_game_bot`)
4. Сохраните токен бота (например: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Создание Web App

1. Отправьте `/newapp` в BotFather
2. Выберите вашего бота
3. Заполните данные:
   - **Title**: Нейросеть или реальность?
   - **Description**: Угадай, реальное фото или AI?
   - **Photo**: Загрузите иконку (512x512px, PNG/JPG)
   - **Web App URL**: `https://your-domain.com/client/`
   
   Для разработки можно использовать ngrok:
   ```
   https://abc123.ngrok.io/client/
   ```

### 3. Получение ngrok URL (для тестирования)

```bash
# Установите ngrok
# Windows: скачайте с https://ngrok.com/download
# Или через chocolatey: choco install ngrok

# Запустите туннель
ngrok http 4173

# Скопируйте HTTPS URL (например: https://abc123.ngrok.io)
# Используйте его в BotFather: https://abc123.ngrok.io/client/
```

### 4. Настройка кнопки в боте

Создайте файл `tg/bot-example.js`:

```javascript
const TelegramBot = require('node-telegram-bot-api');

const token = 'YOUR_BOT_TOKEN_HERE'; // Замените на ваш токен
const bot = new TelegramBot(token, { polling: true });

const webAppUrl = 'https://your-domain.com/client/'; // Замените на ваш URL

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, '🎮 Добро пожаловать в игру "Нейросеть или реальность?"!\n\nУгадай, реальное фото или AI?', {
    reply_markup: {
      inline_keyboard: [[
        {
          text: '🎮 Играть',
          web_app: { url: webAppUrl }
        }
      ]]
    }
  });
});

console.log('Бот запущен!');
```

Запустите бота:

```bash
cd tg
npm install node-telegram-bot-api
node bot-example.js
```

## 🔧 Настройка сервера

### 1. Обновите API_BASE в клиенте

Откройте `tg/client/main.js` и обновите:

```javascript
const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://api.your-domain.com'; // ← Ваш production домен
```

### 2. CORS уже настроен

Сервер уже настроен для работы с Telegram доменами:
- `https://web.telegram.org`
- `https://telegram.org`
- `*.t.me`

Если нужно добавить дополнительные домены, обновите `.env`:

```env
ALLOWED_ORIGINS=https://web.telegram.org,https://telegram.org,https://your-domain.com
```

## 🚀 Запуск

### Локальная разработка

1. **Запустите backend:**
   ```bash
   cd tg
   npm run dev:server
   ```

2. **Запустите клиент:**
   ```bash
   npm run dev:client
   ```

3. **Запустите ngrok:**
   ```bash
   ngrok http 4173
   ```

4. **Обновите Web App URL в BotFather:**
   - Используйте ngrok URL: `https://abc123.ngrok.io/client/`

5. **Протестируйте:**
   - Откройте бота в Telegram
   - Нажмите `/start`
   - Нажмите кнопку "🎮 Играть"

### Production

1. Задеплойте backend на ваш сервер
2. Загрузите содержимое `tg/client/` на веб-сервер
3. Убедитесь, что все доступно по HTTPS
4. Обновите Web App URL в BotFather

## ✅ Чек-лист

- [ ] Бот создан через BotFather
- [ ] Токен бота сохранен
- [ ] Web App создан в BotFather
- [ ] URL Web App настроен (ngrok для разработки или production)
- [ ] Backend сервер запущен
- [ ] API_BASE обновлен в `client/main.js`
- [ ] Бот протестирован в Telegram

## 🔍 Отладка

### Проблемы с Web App

Если Web App не открывается:

1. **Проверьте URL:** Должен начинаться с `https://`
2. **Проверьте доступность:** Откройте URL в браузере
3. **Проверьте CORS:** Убедитесь, что сервер разрешает запросы от Telegram

### Проблемы с сохранением данных

Если данные не сохраняются:

1. CloudStorage доступен только в официальных клиентах Telegram
2. В других клиентах используется localStorage (fallback)
3. Проверьте консоль браузера на ошибки

### Открытие DevTools в Telegram

**Telegram Desktop:**
- Нажмите `Ctrl+Shift+I` (Windows/Linux) или `Cmd+Option+I` (Mac)
- Или: Меню → Settings → Advanced → Enable Debug Mode

**Telegram Web:**
- Обычные DevTools браузера работают

## 📚 Полезные ссылки

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Web App API](https://core.telegram.org/bots/webapps)
- [BotFather документация](https://core.telegram.org/bots/tools#botfather)
- [ngrok документация](https://ngrok.com/docs)

## 🎉 Готово!

Ваша игра теперь готова к использованию в Telegram!





