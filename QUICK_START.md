# 🚀 Быстрый старт: Настройка Google Custom Search API

## Шаг 1: Получите ключи

### 1.1. Google API Key
1. Откройте: https://console.cloud.google.com/
2. Создайте проект (или выберите существующий)
3. Включите **Custom Search API** (APIs & Services → Library)
4. Создайте API ключ (APIs & Services → Credentials → Create Credentials → API Key)
5. Скопируйте ключ (выглядит как: `AIzaSyB...`)

### 1.2. Google CSE ID
1. Откройте: https://programmablesearchengine.google.com/
2. Нажмите **Add** (Добавить)
3. В поле **Sites to search** введите: `*` (звездочка)
4. Введите название (например: "AI Images")
5. Нажмите **Create**
6. Перейдите в **Setup** → **Basics**
7. Скопируйте **Search engine ID** (выглядит как: `0123456789...:abc...`)

## Шаг 2: Создайте файл .env

В корне проекта создайте файл `.env` со следующим содержимым:

```env
GOOGLE_API_KEY=ваш_google_api_ключ_здесь
GOOGLE_CSE_ID=ваш_google_cse_id_здесь
```

> ⚠️ **Важно:** Замените `ваш_google_api_ключ_здесь` и `ваш_google_cse_id_здесь` на реальные значения!

## Шаг 3: Проверьте настройку

Запустите:

```bash
node scripts/check-config.mjs
```

Вы должны увидеть:
```
✅ GOOGLE_API_KEY: установлен
✅ GOOGLE_CSE_ID: установлен
✅ Конфигурация Google API готова к использованию!
```

## Шаг 4: Запустите обновление манифеста

```bash
node scripts/update-manifest.mjs --ai=100
```

## 📘 Подробная инструкция

Если что-то не работает, смотрите подробную инструкцию: **GOOGLE_SETUP_GUIDE.md**



