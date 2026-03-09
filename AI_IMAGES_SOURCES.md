# 📸 Где найти и скачать AI-фото для игры

## 🎯 Топ источников для бесплатных AI-изображений

### 1. **Lexica.art** ⭐ Рекомендуется

**Что это:** Бесплатная галерея AI-арта, сгенерированного через Stable Diffusion

**Плюсы:**
- ✅ Полностью бесплатно
- ✅ Тысячи изображений
- ✅ Реалистичные фото
- ✅ Можно искать по ключевым словам (selfie, portrait, casual photo)
- ✅ Можно скачивать массово

**Как использовать:**
1. Перейдите на https://lexica.art
2. Введите поисковый запрос: `selfie realistic`, `casual photo`, `portrait natural`, `everyday scene`
3. Нажмите на изображение → кнопка Download (или правая кнопка мыши → "Сохранить изображение")
4. Массовая загрузка: используйте браузерное расширение для массового скачивания

**Лицензия:** В основном CC0 (общественное достояние), но проверяйте каждое изображение

---

### 2. **Civitai** ⭐ Отлично для реалистичных фото

**Что это:** Сообщество для обмена AI-моделями и изображениями (Stable Diffusion)

**Плюсы:**
- ✅ Бесплатно
- ✅ Много реалистичных портретов и фото
- ✅ Можно фильтровать по стилю и качеству
- ✅ Можно скачивать целыми галереями

**Как использовать:**
1. Перейдите на https://civitai.com
2. Перейдите в раздел "Images" или "Models"
3. Используйте фильтры: Realistic, Photorealistic, Portrait
4. Скачивайте изображения

**Лицензия:** Зависит от модели, но обычно разрешено коммерческое использование

---

### 3. **Hugging Face Spaces**

**Что это:** Бесплатные AI-инструменты и галереи изображений

**Плюсы:**
- ✅ Полностью бесплатно
- ✅ Множество датасетов с AI-фото
- ✅ Можно скачать целые наборы

**Как использовать:**
1. Перейдите на https://huggingface.co/spaces
2. Поиск: "stable diffusion gallery", "ai images dataset"
3. На некоторых спейсах есть кнопки для массового скачивания

**Рекомендуемые датасеты:**
- `stabilityai/stable-diffusion-xl-base-1.0` (примеры)
- Поиск по запросу "realistic portrait dataset"

---

### 4. **Bing Image Creator** (через Microsoft Copilot)

**Что это:** Бесплатный генератор AI-изображений от Microsoft

**Плюсы:**
- ✅ Полностью бесплатно (с лимитами)
- ✅ Качественные изображения
- ✅ Можно создать множество вариантов

**Как использовать:**
1. Перейдите на https://copilot.microsoft.com
2. Введите промпт: `realistic selfie of a person, casual photo, natural lighting`
3. Скачайте изображения
4. Повторите с разными промптами

**Лимиты:** ~25 изображений в день (бесплатно)

**Промпты для игры:**
```
- "realistic selfie of an adult person indoors, casual phone photo"
- "portrait photo of a person in everyday setting, natural lighting"
- "casual photo of people in a coffee shop, realistic"
- "selfie of a person in a car, natural moment"
- "photo of a person at a train station, realistic"
```

---

### 5. **Kaggle Datasets**

**Что это:** Платформа для датасетов (включая AI-изображения)

**Плюсы:**
- ✅ Можно скачать целые датасеты (тысячи изображений)
- ✅ Бесплатно
- ✅ Разные категории

**Как использовать:**
1. Перейдите на https://www.kaggle.com/datasets
2. Поиск: "ai generated images", "realistic portrait", "stable diffusion"
3. Скачайте датасет (обычно в виде ZIP)

**Рекомендуемые датасеты:**
- Поиск по "realistic ai portrait"
- "AI generated faces dataset"

---

### 6. **Google Images** (с фильтрами)

**Что это:** Поиск изображений Google с фильтром Creative Commons

**Плюсы:**
- ✅ Можно найти много изображений
- ✅ Фильтр по лицензии

**Как использовать:**
1. Перейдите на https://images.google.com
2. Поиск: `AI generated realistic portrait site:lexica.art` или `stable diffusion portrait creative commons`
3. Настройки → Инструменты → Права использования → "Лицензировано для коммерческого использования"
4. Скачайте изображения

**Внимание:** Проверяйте каждое изображение на лицензию!

---

### 7. **Stable Diffusion Web UI** (локально) 🔧 Продвинутый вариант

**Что это:** Запуск Stable Diffusion на своем компьютере

**Плюсы:**
- ✅ Полный контроль
- ✅ Безлимитная генерация
- ✅ Можно генерировать тысячи изображений автоматически

**Как использовать:**
1. Установите Stable Diffusion Web UI: https://github.com/AUTOMATIC1111/stable-diffusion-webui
2. Загрузите реалистичную модель (например, "Realistic Vision")
3. Используйте скрипты для массовой генерации

**Требования:** Видеокарта NVIDIA (рекомендуется) или запуск на CPU (медленно)

---

## 🚀 Рекомендуемая стратегия для игры

### Вариант 1: Быстрый старт (Lexica.art)

1. Перейдите на https://lexica.art
2. Используйте поисковые запросы:
   - `selfie realistic casual`
   - `portrait natural lighting`
   - `everyday scene realistic`
   - `phone photo realistic`
   - `casual indoor selfie`
3. Скачайте 1000-2000 изображений
4. Загрузите в `server/data/images/ai/`

### Вариант 2: Массовая загрузка (Civitai + Kaggle)

1. Найдите датасет на Kaggle с реалистичными AI-портретами
2. Скачайте ZIP-архив
3. Распакуйте и отберите подходящие
4. Загрузите в `server/data/images/ai/`

### Вариант 3: Автоматическая генерация (Bing Image Creator)

1. Создайте список из 100+ промптов
2. Генерируйте по 25 изображений в день
3. Через неделю соберете 500-1000 изображений

---

## 📋 Промпты для генерации (если используете генератор)

```
Реалистичные селфи:
- "realistic selfie of an adult person indoors, casual phone photo, natural lighting"
- "selfie of a person in a bathroom mirror, realistic, unedited colors"
- "selfie of a person in a car, natural moment, realistic"

Портреты:
- "realistic portrait photo of a person, everyday setting, natural lighting"
- "portrait of a person in casual clothes, realistic, professional photo"

Сцены:
- "photo of people in a coffee shop, realistic, casual moment"
- "everyday scene in an office, realistic photo, natural lighting"
- "photo of a person at a train station, realistic, handheld camera"

Важно добавлять:
- "realistic"
- "natural lighting"
- "casual"
- "unedited colors"
- "professional photo" или "phone photo"
```

---

## 🔧 Инструменты для массового скачивания

### Браузерные расширения:

1. **Image Downloader** (Chrome/Firefox)
   - Устанавливает расширение
   - Открывает галерею (например, Lexica.art)
   - Нажимает на расширение → выбирает все изображения → скачивает

2. **DownThemAll** (Firefox)
   - Мощный менеджер загрузок
   - Может скачивать все изображения со страницы

3. **Fatkun Batch Image Downloader** (Chrome)
   - Специально для массового скачивания изображений

### Программы:

1. **wget** (командная строка)
   ```bash
   # Пример (нужно адаптировать под конкретный сайт)
   wget -r -l 1 -H -t 1 -nd -N -np -A.jpg -erobots=off https://lexica.art
   ```

2. **Python скрипты**
   - Можно написать простой скрипт для автоматического скачивания с Lexica/Civitai

---

## ⚖️ Лицензии и права использования

### Важно проверять:

1. **CC0** - можно использовать в коммерческих целях ✅
2. **Creative Commons** - нужно проверить тип лицензии
3. **Unsplash License** - можно использовать в коммерческих целях ✅
4. **Pexels License** - можно использовать в коммерческих целях ✅

### Безопасный подход:

- Используйте источники с явным указанием CC0 или Public Domain
- Для коммерческого использования лучше использовать Lexica.art или датасеты с четкой лицензией
- Если сомневаетесь - используйте только для некоммерческого тестирования

---

## 📁 Структура для загрузки

После скачивания изображений:

```
server/data/images/ai/
  ├── selfie-001.jpg
  ├── selfie-002.jpg
  ├── portrait-001.jpg
  ├── portrait-002.jpg
  ├── scene-001.jpg
  └── ... (1000-2000 файлов)
```

**Рекомендуемые форматы:**
- `.jpg` или `.jpeg` (меньший размер)
- Размер: 600x450px или больше
- Качество: 80-90% (баланс размер/качество)

---

## ✅ Чек-лист

- [ ] Выбрал источник (рекомендую Lexica.art)
- [ ] Скачал 1000-2000 изображений
- [ ] Проверил лицензии
- [ ] Загрузил в `server/data/images/ai/`
- [ ] Запустил `node scripts/add-local-images.mjs`
- [ ] Перезапустил сервер

---

## 🎯 Быстрый старт (пошагово)

1. **Откройте Lexica.art**
   ```
   https://lexica.art
   ```

2. **Установите расширение для массового скачивания**
   - Chrome: "Image Downloader" или "Fatkun"
   - Firefox: "DownThemAll"

3. **Найдите изображения:**
   - Поиск: `selfie realistic`
   - Поиск: `portrait natural`
   - Поиск: `casual photo realistic`

4. **Скачайте массово:**
   - Используйте расширение браузера
   - Или скачивайте вручную (долго, но надежно)

5. **Загрузите в папку:**
   ```
   server/data/images/ai/
   ```

6. **Добавьте в манифест:**
   ```bash
   node scripts/add-local-images.mjs --api-base=http://localhost:3000
   ```

7. **Готово!** 🎉

---

**Удачи в сборе изображений!** Если нужна помощь с настройкой автоматической загрузки - дайте знать!





