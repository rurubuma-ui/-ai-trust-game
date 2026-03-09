# 📝 Изменения для Telegram версии

## Что изменено

### ✅ Удалено
- YaGames SDK (зависимость от Яндекс Игр)
- Все упоминания Яндекс Игр
- Подавление ошибок YaGames SDK

### ✅ Добавлено
- Telegram Web App SDK
- Поддержка Telegram CloudStorage
- Автоматическое использование имени пользователя из Telegram
- CORS настройки для Telegram доменов

### ✅ Изменено
- `client/index.html`: заменен YaGames SDK на Telegram Web App SDK
- `client/main.js`: переписана логика платформы для Telegram
- `server/index.js`: обновлены CORS настройки для Telegram
- Заголовок страницы изменен на "Нейросеть или реальность? - Telegram"

## Как использовать

1. Следуйте инструкциям в `TELEGRAM_SETUP.md`
2. Создайте бота через BotFather
3. Настройте Web App в BotFather
4. Запустите сервер и клиент
5. Протестируйте в Telegram

## Структура проекта

```
tg/
├── client/          # Клиентская часть (HTML/CSS/JS)
├── server/          # Backend сервер
├── scripts/         # Утилиты (обновление манифеста и т.д.)
├── README.md        # Основная документация
├── TELEGRAM_SETUP.md # Инструкции по настройке для Telegram
└── package.json     # Зависимости проекта
```

## Отличия от основной версии

| Функция | Яндекс Игры | Telegram |
|---------|------------|----------|
| SDK | YaGames SDK | Telegram Web App |
| Сохранение данных | YaGames Player API | CloudStorage / localStorage |
| Имя пользователя | Из профиля Яндекс | Из профиля Telegram |
| Домены CORS | yandex.ru, games.yandex.ru | telegram.org, web.telegram.org |

## Следующие шаги

1. Создайте бота через BotFather
2. Настройте Web App URL
3. Протестируйте игру
4. Задеплойте на production сервер





