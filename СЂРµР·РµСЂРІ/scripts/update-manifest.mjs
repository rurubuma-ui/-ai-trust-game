#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PEXELS_API_KEY = process.env.PEXELS_API_KEY ?? null;
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

const aiPeopleSubjects = [
  'candid street photo of a middle-aged woman crossing the road',
  'portrait of an office worker wearing business casual clothes',
  'photo of an elderly couple smiling at a cafe table',
  'candid shot of a young man waiting for the subway',
  'photo of a barista pouring coffee behind the counter',
  'portrait of a doctor in a hospital corridor',
  'photo of a chef plating food in a restaurant kitchen',
  'portrait of a high school student holding textbooks outdoors',
  'photo of a mother and child walking in a city park',
  'portrait of a cyclist resting beside the road',
  'photo of a shop owner arranging clothes in a boutique',
  'portrait of a smiling teacher in a classroom',
  'candid photo of friends laughing at an outdoor market',
  'photo of a gardener tending plants in a greenhouse',
  'portrait of a musician busking on a street corner',
  'photo of a delivery courier with parcels at the doorstep',
  'portrait of a firefighter standing beside a fire engine',
  'photo of a nurse taking notes at a desk',
  'portrait of a construction worker wearing a hard hat',
  'photo of a tourist checking a paper map near a landmark',
];

const aiSceneSubjects = [
  'photo of a residential street with parked cars and trees',
  'sunrise photo over a misty lake in the countryside',
  'photo of commuters walking through a modern train station',
  'photo of a quiet library interior with bookshelves',
  'photo of a busy farmers market with fresh produce',
  'photo of a suburban house with a front yard garden',
  'photo of a city skyline at golden hour with warm light',
  'photo of a rainy night street with reflections and traffic',
  'photo of a snowy mountain village with cottages',
  'photo of a seaside boardwalk with people strolling',
  'photo of a highway with cars during rush hour',
  'photo of a university campus lawn with students studying',
  'photo of a neighborhood playground at sunset',
  'photo of a grocery store aisle with shoppers',
  'photo of a coffee shop interior with patrons working on laptops',
  'photo of a country road lined with autumn trees',
  'photo of a downtown pedestrian crossing at midday',
  'photo of a modern office lobby with natural light',
  'photo of a suburban train arriving at the platform',
  'photo of a weekend flea market with stalls and visitors',
];

const aiDescriptors = [
  'realistic photography',
  'shot on DSLR',
  'natural lighting',
  'shallow depth of field',
  'high resolution photo',
  '35mm film look',
  'documentary style photo',
  'candid moment',
  'handheld photo',
  'soft morning light',
  'overcast lighting',
  'evening golden hour',
  'available light only',
  'balanced exposure',
  'lifestyle photography',
];

const aiTimeDescriptors = [
  'in the morning',
  'at midday',
  'at golden hour',
  'during blue hour',
  'on a cloudy day',
  'at night with street lights',
  'in soft overcast light',
  'on a sunny afternoon',
  'during early evening',
  'shot indoors with window light',
];

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function createRealisticPrompts(target) {
  const prompts = new Set();
  const pools = [...aiPeopleSubjects, ...aiSceneSubjects];
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
  return {
    id: `ai-pollinations-${seed}`,
    type: 'ai',
    url: `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=600&height=450&nologo=true`,
    prompt,
    source: {
      name: 'Pollinations AI',
      license: 'CC0 1.0 / open outputs',
    },
  };
}

async function buildAiEntries(count) {
  const prompts = createRealisticPrompts(count * 2);
  const entries = [];
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
  }
  return entries;
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

  console.log(`[update-manifest] Target sizes -> real: ${realCount}, ai: ${aiCount}`);

  const [realEntries, aiEntries] = await Promise.all([buildRealEntries(realCount), buildAiEntries(aiCount)]);

  if (realEntries.length < realCount) {
    console.warn(`[update-manifest] Only fetched ${realEntries.length} real images.`);
  }
  if (aiEntries.length < aiCount) {
    console.warn(`[update-manifest] Only generated ${aiEntries.length} AI entries.`);
  }

  const manifest = [...realEntries, ...aiEntries];
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  console.log(`[update-manifest] Manifest written to ${outputPath} (total ${manifest.length} items)`);
}

buildManifest().catch((error) => {
  console.error('[update-manifest] Failed to update manifest', error);
  process.exit(1);
});
