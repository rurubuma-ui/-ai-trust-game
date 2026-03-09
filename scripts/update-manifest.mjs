#!/usr/bin/env node
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PEXELS_API_KEY = process.env.PEXELS_API_KEY ?? null;
// Если установлено LEXICA_ENABLED=1, для AI-картинок будем тянуть готовые изображения из Lexica,
// а не генерировать их через Pollinations.
const LEXICA_ENABLED = process.env.LEXICA_ENABLED === '1';
// Google Custom Search API для поиска AI-изображений с фильтром по лицензии
// Требует: GOOGLE_API_KEY и GOOGLE_CSE_ID (Custom Search Engine ID)
// Бесплатный лимит: 100 запросов/день
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? null;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID ?? null;
const GOOGLE_ENABLED = !!(GOOGLE_API_KEY && GOOGLE_CSE_ID);
const DEFAULT_OUTPUT = path.join(__dirname, '..', 'server', 'data', 'imageManifest.json');

const args = process.argv.slice(2);
const params = args.reduce((acc, param) => {
  const [key, value] = param.split('=');
  if (!key) return acc;
  acc[key.replace(/^--/, '')] = value ?? true;
  return acc;
}, {});

const realCount = Number(params.real ?? 500);
const aiCount = Number(params.ai ?? 500);
const outputPath = params.output ? path.resolve(process.cwd(), params.output) : DEFAULT_OUTPUT;

const loremBaseUrl = 'https://loremflickr.com';

// Селфи и простые портреты — максимально похожие на обычные телефонные фото
const aiSelfieSubjects = [
  'selfie of an adult person indoors against a plain wall',
  'selfie of a person in a bathroom mirror with a phone in hand',
  'selfie of a person in an elevator with metal walls',
  'selfie of a person sitting at a desk with a laptop in the background',
  'selfie of a person near a window with city buildings behind',
  'selfie of a person in a kitchen with everyday objects around',
  'selfie of a person in a hallway with doors on the sides',
  'selfie of a person wearing headphones at a computer desk',
  'selfie of a person in a car parked on a street',
  'selfie of a person in a supermarket aisle with shelves behind',
  'selfie of a person standing in front of an apartment door',
  'selfie of a person in a gym changing room mirror',
  'selfie of a person in a stairwell with concrete walls',
  'selfie of a person in a small office with shelves and folders',
  'selfie of a person lying on a sofa with TV light in the background',
];

// Бытовые сцены с людьми (не селфи) — без ярких "героев"
const aiPeopleSubjects = [
  'photo of a person waiting at a bus stop looking at their phone',
  'photo of a person sitting on a bench in a small park',
  'photo of a person standing near a pedestrian crossing on a city street',
  'photo of a person carrying a grocery bag on the sidewalk',
  'photo of a person standing in front of an apartment building entrance',
  'photo of a person looking at the timetable inside a bus or tram',
  'photo of an office worker sitting at a desk with a laptop and papers',
  'photo of a person paying at a supermarket checkout counter',
  'photo of a person walking a dog on a quiet residential street',
  'photo of a person waiting in line at a coffee shop counter',
  'photo of a person sitting alone at a cafe table with a drink and phone',
  'photo of a person reading a book on a bench near a path',
  'photo of a person using a ticket machine at a metro station',
  'photo of a person standing near an elevator in an office building',
  'photo of a person checking their phone while leaning on a railing',
  'photo of a person standing near a vending machine in a corridor',
  'photo of a person sitting on a sofa in a living room with a TV on',
  'photo of a person entering a small grocery store from the street',
  'photo of two people talking at a bus stop on a cloudy day',
  'photo of two people sitting at a table in a food court with trays',
  'photo of a small group of people waiting on a train platform',
  'photo of coworkers standing near a whiteboard in a simple office',
  'photo of friends sitting on the grass in a city park in casual clothes',
  'photo of people standing in a queue at a ticket counter indoors',
  'photo of people walking through a shopping mall corridor with shops',
];

// Общие сцены без фокуса на людях — «фон», который часто встречается в реальной жизни
const aiSceneSubjects = [
  'photo of a residential street with parked cars and trees on both sides',
  'photo of a quiet parking lot near a small supermarket',
  'photo of a simple apartment building courtyard with parked cars',
  'photo of an office corridor with closed doors and fluorescent lights',
  'photo of a stairwell in an apartment building with concrete steps',
  'photo of a small playground between apartment blocks on a cloudy day',
  'photo of a grocery store aisle with shelves of products',
  'photo of a coffee shop interior with a few people working on laptops',
  'photo of a suburban house with a small front yard and parked car',
  'photo of a bus interior with empty seats and handrails',
  'photo of a train platform with signs and benches, few people around',
  'photo of a university campus lawn with students walking in the distance',
  'photo of a quiet library interior with bookshelves and tables',
  'photo of a simple office with desks, chairs and computer monitors',
  'photo of a small convenience store interior with fridges and shelves',
  'photo of a city street on an overcast day with cars and pedestrians',
  'photo of a residential building entrance with intercom and mailboxes',
  'photo of a narrow alley between two brick buildings',
  'photo of a tram stop with shelter and timetable sign',
  'photo of a supermarket parking lot with a few scattered cars',
];

// Делаем AI-картинки более «обычными» и менее «рекламно-идеальными»
// Вместо кучи киношных описаний — имитация случайных снимков с телефона.
const aiDescriptors = [
  'casual phone photo',
  'taken on a smartphone camera',
  'slightly imperfect framing',
  'a bit noisy like a low-light photo',
  'slightly blurry motion',
  'everyday snapshot',
  'unposed moment',
  'no studio lighting',
  'simple composition',
  'slightly underexposed',
  'natural, unedited colors',
  'handheld photo with minor shake',
];

const aiTimeDescriptors = [
  'on a regular weekday',
  'in the afternoon',
  'in the evening indoors',
  'on a cloudy day',
  'in mixed indoor lighting',
  'on a typical workday morning',
  'in soft natural light',
  'under office fluorescent lighting',
  'on a rainy day',
  'at a random moment during the day',
];

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function createRealisticPrompts(target) {
  const prompts = new Set();
  // Комбинируем селфи, сцены с людьми и общие сцены, чтобы увеличить разнообразие
  const pools = [...aiSelfieSubjects, ...aiPeopleSubjects, ...aiSceneSubjects];
  while (prompts.size < target) {
    const subject = randomItem(pools);
    const descriptor = randomItem(aiDescriptors);
    const time = randomItem(aiTimeDescriptors);
    prompts.add(`${subject}, ${descriptor}, ${time}`);
    if (prompts.size >= pools.length * aiDescriptors.length * aiTimeDescriptors.length) {
      break;
    }
  }
  return Array.from(prompts).slice(0, target);
}

async function fetchPexelsPhotos(count) {
  if (!PEXELS_API_KEY) return [];
  const perPage = 80;
  let page = 1;
  const results = [];
  const seen = new Set();
  while (results.length < count && page <= 25) {
    const response = await fetch(`https://api.pexels.com/v1/curated?per_page=${perPage}&page=${page}`, {
      headers: {
        Authorization: PEXELS_API_KEY,
      },
    });
    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    (data.photos ?? []).forEach((photo) => {
      if (results.length >= count) return;
      if (seen.has(photo.id)) return;
      seen.add(photo.id);
      results.push({
        id: `real-pexels-${photo.id}`,
        type: 'real',
        url: `${photo.src?.large ?? photo.src?.medium}?auto=compress&cs=tinysrgb&w=600&h=450&fit=crop`,
        attribution: {
          author: photo.photographer,
          profile: photo.photographer_url,
          sourceUrl: photo.url,
        },
        source: {
          name: 'Pexels',
          license: 'Pexels License',
        },
      });
    });
    page += 1;
  }
  return results.slice(0, count);
}

async function fetchPicsumFallback(count) {
  const results = [];
  for (let i = 0; i < count; i += 1) {
    const topics = ['nature', 'city', 'people', 'animals', 'food', 'travel', 'architecture', 'sport', 'forest', 'beach'];
    const topic = topics[i % topics.length];
    const url = `${loremBaseUrl}/600/450/${topic}?lock=${i}`;
    results.push({
      id: `real-lorem-${topic}-${i}`,
      type: 'real',
      url,
      attribution: {
        author: 'loremflickr contributors',
        profile: 'https://loremflickr.com',
        sourceUrl: 'https://loremflickr.com',
      },
      source: {
        name: 'LoremFlickr',
        license: 'Creative Commons (source: Flickr)',
      },
    });
  }
  return results;
}

function buildPollinationsEntry(prompt, seed) {
  const encodedPrompt = encodeURIComponent(prompt);
  // Используем разные варианты URL для обхода rate limiting
  const baseUrls = [
    'https://image.pollinations.ai',
    'https://pollinations.ai',
  ];
  const baseUrl = baseUrls[seed % baseUrls.length];
  return {
    id: `ai-pollinations-${seed}`,
    type: 'ai',
    url: `${baseUrl}/prompt/${encodedPrompt}?seed=${seed}&width=600&height=450&nologo=true&enhance=true`,
    prompt,
    source: {
      name: 'Pollinations AI',
      license: 'CC0 1.0 / open outputs',
    },
  };
}

async function fetchGoogleImages(count, searchQueries) {
  // Google Custom Search API для поиска AI-изображений с фильтром по лицензии Creative Commons
  // Документация: https://developers.google.com/custom-search/v1/overview
  // Бесплатный лимит: 100 запросов/день
  if (!GOOGLE_ENABLED) {
    return [];
  }

  const results = [];
  const seen = new Set();
  const queries = searchQueries || [
    'AI generated art realistic portrait',
    'AI art selfie casual photo',
    'AI generated image everyday scene',
    'stable diffusion portrait realistic',
    'AI art indoor scene',
    'AI generated photo street scene',
    'AI art office scene',
    'AI generated image apartment',
  ];

  let queryIndex = 0;
  let totalRequests = 0;
  const MAX_REQUESTS = 90; // Оставляем запас от лимита в 100

  while (results.length < count && queryIndex < queries.length && totalRequests < MAX_REQUESTS) {
    const query = queries[queryIndex];
    queryIndex += 1;

    try {
      // Используем Google Custom Search API с фильтром для изображений
      // rights=cc_publicdomain,cc_attribute,cc_sharealike,cc_noncommercial,cc_nonderived
      // фильтрует по Creative Commons лицензиям
      const searchQuery = encodeURIComponent(query);
      const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&q=${searchQuery}&searchType=image&num=10&safe=active&rights=cc_publicdomain,cc_attribute,cc_sharealike,cc_noncommercial,cc_nonderived&imgSize=medium&imgType=photo`;
      
      const resp = await fetch(url);
      totalRequests += 1;

      if (!resp.ok) {
        const errorText = await resp.text();
        console.warn(`[update-manifest] Google API error (${resp.status}):`, errorText.substring(0, 200));
        if (resp.status === 429) {
          console.warn('[update-manifest] Google API rate limit reached, stopping');
          break;
        }
        // Задержка перед следующим запросом
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      const data = await resp.json();
      const items = data.items || [];

      items.forEach((item) => {
        if (results.length >= count) return;
        const imageUrl = item.link;
        if (!imageUrl || seen.has(imageUrl)) return;
        seen.add(imageUrl);

        // Проверяем, что это действительно изображение
        if (!/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(imageUrl)) {
          return;
        }

        results.push({
          id: `ai-google-${item.image?.contextLink?.split('/').pop() || Date.now()}-${results.length}`,
          type: 'ai',
          url: imageUrl,
          prompt: query,
          source: {
            name: 'Google Images (CC)',
            license: 'Creative Commons (verify on source site)',
            originalUrl: item.image?.contextLink || item.displayLink,
          },
        });
      });

      // Задержка между запросами, чтобы не превысить rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.warn('[update-manifest] Failed to fetch from Google:', error.message);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`[update-manifest] Google Images: fetched ${results.length} images using ${totalRequests} API requests`);
  return results.slice(0, count);
}

async function fetchLexicaImages(count) {
  // Простой клиент для публичного Lexica API.
  // Документация может меняться, поэтому при ошибках будет fallback на Pollinations.
  const results = [];
  const seen = new Set();
  // Набор базовых запросов: селфи, интерьеры, город и т.п.
  const queries = [
    'selfie realistic',
    'casual indoor selfie',
    'phone photo street',
    'everyday city scene',
    'subtle ai generated portrait',
    'indoor office photo',
    'apartment hallway photo',
    'parking lot photo',
  ];

  let page = 0;
  while (results.length < count && page < queries.length) {
    const q = encodeURIComponent(queries[page]);
    const url = `https://lexica.art/api/v1/search?q=${q}`;
    page += 1;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        console.warn('[update-manifest] Lexica API error:', resp.status, resp.statusText);
        continue;
      }
      const data = await resp.json();
      const images = data.images ?? [];
      images.forEach((img) => {
        if (results.length >= count) return;
        const id = img.id || img.seed || img.src;
        if (!id || seen.has(id)) return;
        seen.add(id);
        if (!img.src) return;
        results.push({
          id: `ai-lexica-${id}`,
          type: 'ai',
          url: img.src,
          prompt: img.prompt ?? '',
          source: {
            name: 'Lexica',
            license: 'Refer to Lexica terms of use',
          },
        });
      });
    } catch (error) {
      console.warn('[update-manifest] Failed to fetch from Lexica:', error.message);
    }
  }
  return results.slice(0, count);
}

async function buildAiEntries(count) {
  const entries = [];
  
  // Приоритет 1: Google Custom Search API (если включен) - лучший источник
  // Ищет по всему интернету с фильтром Creative Commons
  if (GOOGLE_ENABLED) {
    console.log('[update-manifest] Using Google Custom Search API for AI images...');
    const googleQueries = createRealisticPrompts(Math.min(10, Math.ceil(count / 10))).map(p => 
      `"${p}" AI generated art`
    );
    const googleResults = await fetchGoogleImages(count, googleQueries);
    entries.push(...googleResults);
    
    if (entries.length >= count) {
      return entries.slice(0, count);
    }
    console.log(`[update-manifest] Google provided ${googleResults.length} images, need ${count - entries.length} more`);
  }
  
  // Приоритет 2: Lexica (если включен и Google не дал достаточно)
  if (LEXICA_ENABLED && entries.length < count) {
    const remaining = count - entries.length;
    const lexica = await fetchLexicaImages(remaining);
    entries.push(...lexica);
    
    if (entries.length >= count) {
      return entries.slice(0, count);
    }
    console.log(`[update-manifest] Lexica provided ${lexica.length} images, need ${count - entries.length} more`);
  }

  // Приоритет 3: Pollinations (fallback)
  if (entries.length < count) {
    const remaining = count - entries.length;
    const prompts = createRealisticPrompts(remaining * 2);
    const usedSeeds = new Set();
    let promptIndex = 0;
    
    while (entries.length < count && promptIndex < prompts.length) {
      const prompt = prompts[promptIndex];
      promptIndex += 1;
      let seed = Math.floor(Math.random() * 90_000) + 10_000 + entries.length;
      while (usedSeeds.has(seed)) {
        seed += 1;
      }
      usedSeeds.add(seed);
      
      entries.push(buildPollinationsEntry(prompt, seed));
      
      // Задержка каждые 10 запросов, чтобы не перегружать сервер и избежать 429
      if (entries.length % 10 === 0 && entries.length < count) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  return entries.slice(0, count);
}

async function buildRealEntries(count) {
  const entries = [];
  try {
    const pexels = await fetchPexelsPhotos(count);
    entries.push(...pexels);
  } catch (error) {
    console.warn('[update-manifest] Failed to fetch from Pexels:', error.message);
  }
  if (entries.length < count) {
    const fallback = await fetchPicsumFallback(count - entries.length);
    entries.push(...fallback);
  }
  return entries.slice(0, count);
}

async function buildManifest() {
  if (!PEXELS_API_KEY) {
    console.warn('[update-manifest] PEXELS_API_KEY not provided. Will rely on Lorem Picsum fallback for real images.');
  }
  
  if (GOOGLE_ENABLED) {
    console.log('[update-manifest] Google Custom Search API enabled for AI images (CC license filter)');
  } else if (GOOGLE_API_KEY || GOOGLE_CSE_ID) {
    console.warn('[update-manifest] Google API partially configured. Need both GOOGLE_API_KEY and GOOGLE_CSE_ID.');
  }

  // Загружаем существующий манифест, чтобы сохранить локальные AI-изображения
  let existingManifest = [];
  let localAiEntries = [];
  if (fs.existsSync(outputPath)) {
    try {
      existingManifest = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      // Сохраняем локальные AI-изображения (те, что загружены вручную)
      localAiEntries = existingManifest.filter(item => 
        item.id && item.id.startsWith('local-ai-') && item.type === 'ai'
      );
      if (localAiEntries.length > 0) {
        console.log(`[update-manifest] Preserving ${localAiEntries.length} local AI images`);
      }
    } catch (error) {
      console.warn('[update-manifest] Failed to read existing manifest:', error.message);
    }
  }

  console.log(`[update-manifest] Target sizes -> real: ${realCount}, ai: ${aiCount}`);

  const [realEntries, aiEntries] = await Promise.all([buildRealEntries(realCount), buildAiEntries(aiCount)]);

  if (realEntries.length < realCount) {
    console.warn(`[update-manifest] Only fetched ${realEntries.length} real images.`);
  }
  if (aiEntries.length < aiCount) {
    console.warn(`[update-manifest] Only generated ${aiEntries.length} AI entries.`);
  }

  // Объединяем: реальные фото с внешних источников + AI с внешних источников + локальные AI
  const manifest = [...realEntries, ...aiEntries, ...localAiEntries];
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  console.log(`[update-manifest] Manifest written to ${outputPath} (total ${manifest.length} items)`);
  console.log(`[update-manifest]   - Real images: ${realEntries.length}`);
  console.log(`[update-manifest]   - External AI images: ${aiEntries.length}`);
  console.log(`[update-manifest]   - Local AI images: ${localAiEntries.length}`);
}

buildManifest().catch((error) => {
  console.error('[update-manifest] Failed to update manifest', error);
  process.exit(1);
});
