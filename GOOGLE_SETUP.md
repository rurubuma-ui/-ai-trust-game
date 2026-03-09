# Настройка Google Custom Search API для AI-изображений

## Преимущества Google Custom Search API

✅ **Ищет по всему интернету** - не ограничен одной базой данных  
✅ **Фильтр по Creative Commons** - автоматически находит изображения с подходящими лицензиями  
✅ **Бесплатный лимит: 100 запросов/день** - достаточно для обновления манифеста  
✅ **Разнообразие источников** - находит изображения с личных блогов, галерей и т.д.

## Шаги настройки

### 1. Создать Google Cloud Project

1. Перейдите на [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект (или выберите существующий)
3. Запомните название проекта

### 2. Включить Custom Search API

1. В Google Cloud Console перейдите в **APIs & Services** → **Library**
2. Найдите **Custom Search API**
3. Нажмите **Enable** (Включить)

### 3. Создать API ключ

1. Перейдите в **APIs & Services** → **Credentials**
2. Нажмите **Create Credentials** → **API Key**
3. Скопируйте созданный API ключ
4. (Опционально) Ограничьте ключ только для Custom Search API в целях безопасности

### 4. Создать Custom Search Engine (CSE)

1. Перейдите на [Google Custom Search](https://programmablesearchengine.google.com/)
2. Нажмите **Add** (Добавить)
3. В поле **Sites to search** введите: `*` (звездочка означает поиск по всему интернету)
4. В поле **Name** введите любое имя (например, "AI Images Search")
5. Нажмите **Create**
6. Перейдите в **Setup** → **Basics**
7. Скопируйте **Search engine ID** (CSE ID)

### 5. Настроить переменные окружения

Добавьте в ваш `.env` файл (или установите в системе):

```bash
GOOGLE_API_KEY=ваш_api_ключ_здесь
GOOGLE_CSE_ID=ваш_cse_id_здесь
```

### 6. Запустить обновление манифеста

```bash
node scripts/update-manifest.mjs --ai=500
```

## Как это работает

1. **Google Custom Search API** ищет по всему интернету изображения с Creative Commons лицензией
2. Запросы формируются на основе ваших промптов (например: `"selfie of an adult person indoors" AI generated art`)
3. API возвращает до 10 изображений на запрос
4. Система автоматически фильтрует результаты и добавляет их в манифест
5. Если Google не дает достаточно изображений, система автоматически использует Lexica или Pollinations как fallback

## Ограничения

- **100 бесплатных запросов/день** - этого достаточно для ~1000 изображений (10 изображений на запрос)
- После превышения лимита система автоматически переключится на Lexica/Pollinations
- Для большего объема нужен платный план Google Cloud

## Приоритет источников

1. **Google Custom Search** (если настроен) - лучший источник, ищет по всему интернету
2. **Lexica** (если `LEXICA_ENABLED=1`) - галерея AI-изображений
3. **Pollinations** - генерация через API (fallback)

## Проверка работы

После настройки запустите:

```bash
node scripts/update-manifest.mjs --ai=100
```

В логах вы должны увидеть:
```
[update-manifest] Google Custom Search API enabled for AI images (CC license filter)
[update-manifest] Using Google Custom Search API for AI images...
[update-manifest] Google Images: fetched X images using Y API requests
```



