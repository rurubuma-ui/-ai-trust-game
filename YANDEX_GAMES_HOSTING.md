# 🎮 Хостинг для Яндекс Игр

## ⚠️ Важно понимать

**Яндекс Игры НЕ предоставляют серверную инфраструктуру!**

Они предоставляют:
- ✅ Хостинг статики (HTML, CSS, JS)
- ✅ CDN для раздачи файлов
- ✅ API для монетизации
- ❌ **НЕ предоставляют:** серверы для backend/WebSocket

## 🏗️ Архитектура для Яндекс Игр

```
┌─────────────────────────────────────┐
│   Яндекс Игры (клиентская часть)    │
│   - HTML/CSS/JS файлы               │
│   - Раздаются через CDN             │
└──────────────┬──────────────────────┘
               │ HTTP/WebSocket запросы
               │
               ▼
┌─────────────────────────────────────┐
│   Ваш Backend сервер (отдельно!)    │
│   - Node.js сервер                  │
│   - WebSocket для мультиплеера      │
│   - REST API                        │
└─────────────────────────────────────┘
```

## 🔧 Текущая конфигурация

В вашем коде (`client/main.js`):

```javascript
const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin;
```

**Проблема:** В production используется `window.location.origin`, что означает подключение к домену Яндекс Игр. Но ваш backend должен быть на отдельном домене!

## ✅ Решение: Настроить отдельный домен для backend

### Вариант 1: Отдельный домен/поддомен для backend

```javascript
const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://api.your-domain.com'; // Ваш backend домен

const WS_BASE = API_BASE.replace(/^http/, 'ws');
```

### Вариант 2: Переменная окружения (рекомендуется)

Создайте конфигурационный файл, который будет загружаться из внешнего источника:

```javascript
// В начале main.js
let API_BASE = 'http://localhost:3000';

// Загружаем конфигурацию с сервера или используем значения по умолчанию
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  // В production используем ваш backend домен
  API_BASE = 'https://api.your-domain.com';
}

const WS_BASE = API_BASE.replace(/^http/, 'ws');
```

## 🚀 Варианты хостинга backend

### 1. **Yandex Cloud** (рекомендуется для РФ)
- ✅ Российский хостинг
- ✅ Хорошая интеграция с Яндекс сервисами
- ✅ Compute Cloud для VM
- 💰 От ~1000₽/месяц

**Создание VM:**
1. Создайте VM в Yandex Cloud
2. Установите Node.js
3. Настройте Nginx для проксирования
4. Настройте SSL сертификат

### 2. **DigitalOcean**
- ✅ Простой в использовании
- ✅ Хорошая документация
- ✅ Droplets от $6/месяц
- ✅ App Platform для автоматического деплоя

### 3. **AWS / Azure**
- ✅ Мощная инфраструктура
- ✅ Автомасштабирование
- ⚠️ Сложнее в настройке
- 💰 Pay-as-you-go

### 4. **Heroku / Railway / Render**
- ✅ Простой деплой
- ✅ Автоматическое масштабирование
- ⚠️ Может быть дороже при росте нагрузки

## 📋 Чеклист для production

### 1. Backend сервер
- [ ] Выбрать хостинг провайдера
- [ ] Настроить домен для API (например: `api.your-game.com`)
- [ ] Установить Node.js на сервере
- [ ] Настроить SSL сертификат (Let's Encrypt бесплатный)
- [ ] Настроить Nginx для проксирования и балансировки

### 2. Обновить клиентский код
- [ ] Изменить `API_BASE` на production домен
- [ ] Настроить CORS на backend (разрешить домен Яндекс Игр)
- [ ] Протестировать WebSocket подключения

### 3. Безопасность
- [ ] Настроить firewall
- [ ] Ограничить CORS только нужными доменами
- [ ] Настроить rate limiting
- [ ] Использовать HTTPS/WSS

### 4. Мониторинг
- [ ] Настроить логирование
- [ ] Настроить мониторинг (Uptime, Pingdom)
- [ ] Настроить алерты при падении сервера

## 🔒 CORS настройка для backend

В `server/index.js` уже есть `cors()`, но нужно ограничить домены:

```javascript
app.use(cors({
  origin: [
    'https://games.yandex.ru',
    'https://yandex.ru/games',
    // Добавьте другие домены Яндекс Игр при необходимости
  ],
  credentials: true
}));
```

## 🌐 Пример конфигурации Nginx

```nginx
server {
    listen 80;
    server_name api.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 💰 Примерная стоимость

**Минимальная конфигурация (до 1000 пользователей):**
- VPS: ~$10-20/месяц (2 CPU, 2GB RAM)
- Домен: ~$10-15/год
- SSL: Бесплатно (Let's Encrypt)
- **Итого: ~$10-20/месяц**

**Для масштабирования (1000+ пользователей):**
- VPS: ~$20-40/месяц (4 CPU, 4-8GB RAM)
- Балансировщик нагрузки: ~$10-20/месяц
- Redis (опционально): ~$10-15/месяц
- **Итого: ~$40-75/месяц**

## 🎯 Итог

1. **Яндекс Игры** хостит только клиентскую часть
2. **Ваш backend** должен быть на отдельном сервере
3. **Нужно** настроить отдельный домен для API
4. **Рекомендуется** использовать российский хостинг (Yandex Cloud)

## 📚 Полезные ссылки

- [Yandex Cloud Documentation](https://cloud.yandex.ru/docs/)
- [DigitalOcean Tutorials](https://www.digitalocean.com/community/tags/node-js)
- [Let's Encrypt](https://letsencrypt.org/) - бесплатные SSL сертификаты



