#!/usr/bin/env node
import 'dotenv/config';

console.log('🔍 Проверка конфигурации Google Custom Search API...\n');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const LEXICA_ENABLED = process.env.LEXICA_ENABLED === '1';

let allOk = true;

// Проверка Google API
console.log('📋 Google Custom Search API:');
if (GOOGLE_API_KEY && GOOGLE_CSE_ID) {
  console.log('  ✅ GOOGLE_API_KEY: установлен');
  console.log('  ✅ GOOGLE_CSE_ID: установлен');
  console.log(`  📝 API Key: ${GOOGLE_API_KEY.substring(0, 20)}...`);
  console.log(`  📝 CSE ID: ${GOOGLE_CSE_ID.substring(0, 20)}...`);
} else {
  console.log('  ❌ GOOGLE_API_KEY: НЕ установлен');
  console.log('  ❌ GOOGLE_CSE_ID: НЕ установлен');
  console.log('  💡 Создайте файл .env в корне проекта и добавьте:');
  console.log('     GOOGLE_API_KEY=ваш_ключ');
  console.log('     GOOGLE_CSE_ID=ваш_cse_id');
  allOk = false;
}

console.log('\n📋 Другие настройки:');
if (PEXELS_API_KEY) {
  console.log('  ✅ PEXELS_API_KEY: установлен');
} else {
  console.log('  ⚠️  PEXELS_API_KEY: не установлен (будет использован Lorem Picsum)');
}

if (LEXICA_ENABLED) {
  console.log('  ✅ LEXICA_ENABLED: включен');
} else {
  console.log('  ℹ️  LEXICA_ENABLED: выключен (по умолчанию)');
}

console.log('\n' + '='.repeat(60));

if (allOk) {
  console.log('✅ Конфигурация Google API готова к использованию!');
  console.log('\n💡 Теперь можно запустить:');
  console.log('   node scripts/update-manifest.mjs --ai=100');
} else {
  console.log('❌ Google API не настроен. Следуйте инструкции в GOOGLE_SETUP_GUIDE.md');
  console.log('\n📘 Инструкция: GOOGLE_SETUP_GUIDE.md');
}

console.log('='.repeat(60) + '\n');



