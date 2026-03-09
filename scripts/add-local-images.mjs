#!/usr/bin/env node
/**
 * Скрипт для добавления локальных AI-изображений в imageManifest.json
 * 
 * Использование:
 * 1. Загрузите AI-изображения в папку server/data/images/ai/
 * 2. Запустите: node scripts/add-local-images.mjs
 * 
 * Или с параметрами:
 * node scripts/add-local-images.mjs --dir=server/data/images/ai --type=ai --api-base=https://api.your-domain.com
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const params = args.reduce((acc, param) => {
  const [key, value] = param.split('=');
  if (!key) return acc;
  acc[key.replace(/^--/, '')] = value ?? true;
  return acc;
}, {});

// Параметры
// По умолчанию работаем только с AI-изображениями
// Реальные фото продолжают загружаться с внешних сервисов (Pexels/LoremFlickr)
const imagesDir = params.dir || path.join(__dirname, '..', 'server', 'data', 'images', 'ai');
const imageType = params.type || 'ai'; // По умолчанию только 'ai', 'real' не используется для локальных файлов
const apiBase = params['api-base'] || 'http://localhost:3000'; // Базовый URL вашего API
const manifestPath = params.manifest || path.join(__dirname, '..', 'server', 'data', 'imageManifest.json');
const sourceName = params.source || 'Local AI Images';

// Поддерживаемые форматы изображений
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

/**
 * Получает все изображения из указанной директории
 */
function getImageFiles(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`❌ Папка не существует: ${dir}`);
    console.log(`💡 Создайте папку и загрузите туда изображения:`);
    console.log(`   mkdir -p ${dir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dir);
  const imageFiles = files
    .filter(file => {
      const ext = path.extname(file).toLowerCase();
      return IMAGE_EXTENSIONS.includes(ext);
    })
    .map(file => ({
      filename: file,
      path: path.join(dir, file),
      ext: path.extname(file).toLowerCase(),
    }));

  return imageFiles;
}

/**
 * Создает запись для манифеста
 */
function createManifestEntry(imageFile, index) {
  const filename = imageFile.filename;
  const baseName = path.basename(filename, imageFile.ext);
  
  // Генерируем уникальный ID
  const id = `local-${imageType}-${baseName}-${index}`;
  
  // URL для доступа к изображению через API
  // Если imagesDir содержит 'ai' или 'real', используем это в пути
  const relativePath = path.relative(
    path.join(__dirname, '..', 'server', 'data', 'images'),
    imageFile.path
  ).replace(/\\/g, '/'); // Заменяем обратные слеши на прямые для URL
  
  const imageUrl = `${apiBase}/images/${relativePath}`;
  
  return {
    id,
    type: imageType,
    url: imageUrl,
    source: {
      name: sourceName,
      license: 'Custom (Local Storage)',
    },
    // Для AI изображений можно добавить prompt (если есть в имени файла)
    ...(imageType === 'ai' && {
      prompt: baseName.replace(/[-_]/g, ' '), // Пример: "selfie-person" -> "selfie person"
    }),
  };
}

/**
 * Загружает существующий манифест
 */
function loadManifest() {
  if (!fs.existsSync(manifestPath)) {
    console.warn(`⚠️  Манифест не найден: ${manifestPath}`);
    console.log(`💡 Создаю новый манифест...`);
    return [];
  }

  try {
    const content = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ Ошибка при чтении манифеста: ${error.message}`);
    return [];
  }
}

/**
 * Сохраняет манифест
 */
function saveManifest(manifest) {
  const content = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(manifestPath, content, 'utf-8');
  console.log(`✅ Манифест сохранен: ${manifestPath}`);
}

/**
 * Основная функция
 */
function main() {
  console.log('📸 Добавление локальных AI-изображений в манифест\n');
  console.log(`📁 Папка с изображениями: ${imagesDir}`);
  console.log(`📋 Тип изображений: ${imageType}`);
  console.log(`💡 Примечание: Только AI-фото загружаются локально.`);
  console.log(`   Реальные фото продолжают загружаться с внешних сервисов.\n`);
  console.log(`🌐 API Base URL: ${apiBase}`);
  console.log(`📄 Манифест: ${manifestPath}\n`);
  
  if (imageType !== 'ai') {
    console.warn(`⚠️  Внимание: Используется тип "${imageType}".`);
    console.warn(`   Для локальной загрузки рекомендуется только тип "ai".`);
    console.warn(`   Реальные фото должны загружаться с внешних сервисов.\n`);
  }

  // Получаем изображения
  const imageFiles = getImageFiles(imagesDir);
  
  if (imageFiles.length === 0) {
    console.error(`❌ В папке ${imagesDir} не найдено изображений!`);
    console.log(`💡 Поддерживаемые форматы: ${IMAGE_EXTENSIONS.join(', ')}`);
    process.exit(1);
  }

  console.log(`✅ Найдено изображений: ${imageFiles.length}\n`);

  // Загружаем существующий манифест
  const existingManifest = loadManifest();
  
  // Фильтруем уже существующие локальные изображения (чтобы не дублировать)
  const existingLocalIds = new Set(
    existingManifest
      .filter(item => item.id.startsWith(`local-${imageType}-`))
      .map(item => item.id)
  );

  // Создаем новые записи
  const newEntries = [];
  let addedCount = 0;
  let skippedCount = 0;

  imageFiles.forEach((imageFile, index) => {
    const entry = createManifestEntry(imageFile, index);
    
    // Проверяем, не существует ли уже такая запись
    if (existingLocalIds.has(entry.id)) {
      skippedCount++;
      return;
    }

    newEntries.push(entry);
    addedCount++;
  });

  if (newEntries.length === 0) {
    console.log(`⚠️  Все изображения уже добавлены в манифест!`);
    console.log(`   Пропущено: ${skippedCount}`);
    return;
  }

  // Добавляем новые записи в манифест
  const updatedManifest = [...existingManifest, ...newEntries];

  // Сохраняем
  saveManifest(updatedManifest);

  console.log(`\n✅ Готово!`);
  console.log(`   Добавлено новых: ${addedCount}`);
  console.log(`   Пропущено (уже есть): ${skippedCount}`);
  console.log(`   Всего в манифесте: ${updatedManifest.length}`);
  console.log(`\n💡 Теперь перезапустите сервер, чтобы изменения вступили в силу.`);
}

// Запуск
main();

