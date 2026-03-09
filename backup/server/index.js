function handleQuestionTimeout(match) {
  if (match.ended) return;
  const question = match.currentQuestion;
  if (!question) return;
  if (match.questionAnsweredBy) return;

  match.players.forEach((player) => {
    bumpStats(match, player.id, { wrong: 1, totalTimeMs: QUESTION_TIME_LIMIT_MS });
  });

  cleanupCurrentQuestion(match);
  broadcast(match, { type: 'question-timeout', payload: { matchId: match.id } });
  scheduleNextQuestion(match);
}
import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { v4 as uuid } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const MANIFEST_PATH = path.join(__dirname, 'data', 'imageManifest.json');
const QUESTS_PATH = path.join(__dirname, 'data', 'quests.json');
const BANNED_WORDS_PATH = path.join(__dirname, 'data', 'bannedWords.json');
const MAX_SINGLE_CACHE_MINUTES = 10;
const TARGET_SCORE = 10;
const QUESTION_TIME_LIMIT_MS = 4000;
const POST_QUESTION_DELAY_MS = 400;
const IMAGE_LOAD_DELAY_MS = 800; // Задержка перед стартом таймера для загрузки изображения

// Проверка на запрещенные слова
function containsBannedWords(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  
  if (!bannedWords || !Array.isArray(bannedWords) || bannedWords.length === 0) {
    console.warn('[bannedWords] Banned words list is empty!');
    return false;
  }
  
  // Приводим текст к нижнему регистру и нормализуем
  const lowerText = text.toLowerCase().trim();
  if (!lowerText) {
    return false;
  }
  
  // Убираем все спецсимволы и пробелы, оставляем только буквы и цифры
  // Это нужно для проверки случаев типа "сука123" или "123сука"
  const cleanText = lowerText.replace(/[^а-яёa-z0-9]/gi, '');
  if (!cleanText) {
    return false;
  }
  
  // Создаем Set для быстрого поиска (все слова уже в нижнем регистре из loadBannedWords)
  const bannedSet = new Set(bannedWords);
  
  // Проверка 1: Точное совпадение после очистки от спецсимволов
  if (bannedSet.has(cleanText)) {
    console.log(`[bannedWords] Found exact match: "${cleanText}"`);
    return true;
  }
  
  // Проверка 2: Прямой поиск запрещенных слов в очищенном тексте
  // Это основной и самый надежный способ проверки
  for (const bannedWord of bannedWords) {
    if (!bannedWord || bannedWord.length < 2) continue;
    
    // Если запрещенное слово содержится в тексте (даже как подстрока)
    // Это ловит случаи типа "сука123", "123сука", "сука", "Сука", "СУКА" и т.д.
    if (cleanText.indexOf(bannedWord) !== -1) {
      console.log(`[bannedWords] Found banned word "${bannedWord}" in text "${cleanText}"`);
      return true;
    }
  }
  
  // Проверка 3: Разбиваем оригинальный текст на слова (по пробелам и спецсимволам)
  // и проверяем каждое слово отдельно
  const wordSeparators = /[\s\-_.,;:!?@#$%^&*()+=\[\]{}|\\\/<>"'`~№]+/;
  const words = lowerText.split(wordSeparators)
    .map(w => w.replace(/[^а-яёa-z0-9]/gi, ''))
    .filter(w => w.length > 0);
  
  for (const word of words) {
    // Точное совпадение слова
    if (bannedSet.has(word)) {
      console.log(`[bannedWords] Found banned word in split words: "${word}"`);
      return true;
    }
    
    // Проверяем, содержит ли слово запрещенное слово
    for (const bannedWord of bannedWords) {
      if (bannedWord.length >= 2 && word.indexOf(bannedWord) !== -1) {
        // Для коротких слов (2-4 символа) проверяем более строго
        if (bannedWord.length <= 4 && word.length <= bannedWord.length + 2) {
          console.log(`[bannedWords] Found banned word "${bannedWord}" inside word "${word}"`);
          return true;
        }
        // Для длинных слов также проверяем
        if (bannedWord.length > 4 && word.indexOf(bannedWord) !== -1) {
          console.log(`[bannedWords] Found banned word "${bannedWord}" inside word "${word}"`);
          return true;
        }
      }
    }
  }
  
  return false;
}

// Проверка уникальности ника
function isAliasAvailable(alias) {
  if (!alias) return false;
  const normalized = alias.toLowerCase().trim();
  return !usedAliases.has(normalized);
}

// Регистрация ника
function registerAlias(alias) {
  if (!alias) return false;
  const normalized = alias.toLowerCase().trim();
  usedAliases.add(normalized);
  return true;
}

// Удаление ника из реестра (при отключении игрока)
function unregisterAlias(alias) {
  if (!alias) return;
  const normalized = alias.toLowerCase().trim();
  usedAliases.delete(normalized);
}

function sanitizeAlias(value) {
  if (!value || typeof value !== 'string') return '';
  const cleaned = value.replace(/\s+/g, ' ').trim().slice(0, 24);
  return cleaned;
}

// Валидация ника с проверкой на запрещенные слова и уникальность
function validateAlias(alias, currentAlias = null) {
  if (!alias || typeof alias !== 'string') {
    return { valid: false, error: 'Имя должно быть строкой' };
  }
  
  const cleaned = sanitizeAlias(alias);
  if (!cleaned || cleaned.length < 1) {
    return { valid: false, error: 'Имя должно содержать хотя бы один символ' };
  }
  
  if (cleaned.length < 2) {
    return { valid: false, error: 'Имя должно содержать минимум 2 символа' };
  }
  
  if (cleaned.length > 24) {
    return { valid: false, error: 'Имя не должно превышать 24 символа' };
  }
  
  // КРИТИЧНО: Проверка на запрещенные слова должна быть первой
  const hasBanned = containsBannedWords(cleaned);
  if (hasBanned) {
    console.log(`[alias] Validation failed for "${cleaned}" - contains banned words`);
    return { valid: false, error: 'Имя содержит недопустимые слова' };
  }
  
  // Проверка уникальности (если имя изменилось)
  const normalized = cleaned.toLowerCase().trim();
  const currentNormalized = currentAlias ? currentAlias.toLowerCase().trim() : null;
  
  if (normalized !== currentNormalized && !isAliasAvailable(cleaned)) {
    return { valid: false, error: 'Это имя уже занято' };
  }
  
  return { valid: true, alias: cleaned };
}

function getPlayerStats(match, playerId) {
  let stats = match.stats.get(playerId);
  if (!stats) {
    stats = { correct: 0, wrong: 0, totalTimeMs: 0 };
    match.stats.set(playerId, stats);
  }
  return stats;
}

function bumpStats(match, playerId, updates = {}) {
  const stats = getPlayerStats(match, playerId);
  if (updates.correct) stats.correct += updates.correct;
  if (updates.wrong) stats.wrong += updates.wrong;
  if (updates.totalTimeMs) stats.totalTimeMs += updates.totalTimeMs;
}

function clearQuestionTimer(match) {
  if (match.questionTimer) {
    clearTimeout(match.questionTimer);
    match.questionTimer = null;
  }
}

function clearPendingNextQuestion(match) {
  if (match.pendingNextQuestion) {
    clearTimeout(match.pendingNextQuestion);
    match.pendingNextQuestion = null;
  }
}

function cleanupCurrentQuestion(match) {
  clearQuestionTimer(match);
  if (match.imageReadyTimeout) {
    clearTimeout(match.imageReadyTimeout);
    match.imageReadyTimeout = null;
  }
  if (match.startTimeout) {
    clearTimeout(match.startTimeout);
    match.startTimeout = null;
  }
  const questionId = match.currentQuestion?.questionId;
  if (questionId) {
    activeQuestions.delete(questionId);
  }
  match.currentQuestion = null;
  match.questionAnsweredBy = null;
  match.questionStart = null;
  match.questionDeadline = null;
  match.imageReadyPlayers = new Set();
}

function scheduleNextQuestion(match) {
  if (match.ended) return;
  clearQuestionTimer(match);
  clearPendingNextQuestion(match);
  match.pendingNextQuestion = setTimeout(() => {
    match.pendingNextQuestion = null;
    startNextQuestion(match);
  }, POST_QUESTION_DELAY_MS);
}

function loadImageManifest() {
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('Manifest file is not an array');
    }
    return parsed;
  } catch (error) {
    console.error('[manifest] Failed to load image manifest:', error);
    return [];
  }
}

function loadQuests() {
  try {
    const raw = fs.readFileSync(QUESTS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (error) {
    console.error('[quests] Failed to load quests:', error);
    return null;
  }
}

// Базовый список запрещенных слов (на случай, если файл не загрузится)
const FALLBACK_BANNED_WORDS = [
  'сука', 'суки', 'сукин', 'сучара', 'сучий',
  'блять', 'блядь', 'бля', 'блядина', 'бляди',
  'хуй', 'хуя', 'хуе', 'хуи', 'хуйня', 'хуев', 'хуёв',
  'пизда', 'пиздец', 'пизд', 'пиздюк', 'пиздюли', 'пиздить',
  'ебан', 'ебал', 'ебать', 'ебат', 'ебану', 'ебануть',
  'мудак', 'мудаки', 'мудила', 'мудло',
  'гандон', 'гондон',
  'долбоеб', 'долбоёб',
  'еблан', 'ебланы',
  'залупа', 'залуп',
  'пидор', 'пидорас', 'пидарас', 'пидр', 'пидары',
  'гомик', 'гомосек',
  'педик', 'педераст',
  'шлюха', 'шлюхи', 'шлюш',
  'blyat', 'blyad', 'suka', 'hui', 'pizda', 'ebat',
  'fuck', 'shit', 'bitch', 'asshole', 'nigger', 'retard', 'gay', 'fag'
].map(w => w.toLowerCase());

function loadBannedWords() {
  try {
    const raw = fs.readFileSync(BANNED_WORDS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    // Объединяем все категории в один массив
    const allWords = [];
    if (parsed.profanity) allWords.push(...parsed.profanity);
    if (parsed.religious) allWords.push(...parsed.religious);
    if (parsed.offensive) allWords.push(...parsed.offensive);
    // Приводим к нижнему регистру для сравнения и удаляем дубликаты
    const normalized = [...new Set(allWords.map(word => String(word).toLowerCase().trim()))].filter(w => w.length > 0);
    
    // Добавляем fallback слова, если они отсутствуют
    FALLBACK_BANNED_WORDS.forEach(word => {
      if (!normalized.includes(word)) {
        normalized.push(word);
      }
    });
    
    console.log(`[bannedWords] Loaded ${normalized.length} banned words`);
    
    // Проверяем наличие ключевых слов для отладки
    const testWords = ['сука', 'блять', 'хуй'];
    testWords.forEach(word => {
      if (normalized.includes(word)) {
        console.log(`[bannedWords] Word "${word}" found in list`);
      } else {
        console.warn(`[bannedWords] Word "${word}" NOT found in list!`);
      }
    });
    
    return normalized;
  } catch (error) {
    console.error('[bannedWords] Failed to load banned words:', error);
    console.warn('[bannedWords] Using fallback banned words list');
    return FALLBACK_BANNED_WORDS;
  }
}

let imageManifest = loadImageManifest();
let questsData = loadQuests();
let bannedWords = loadBannedWords();

// Тестовая функция для проверки работы фильтрации при запуске
console.log(`[bannedWords] Initializing with ${bannedWords.length} banned words`);
if (bannedWords.length > 0) {
  const testWords = ['сука', 'блять', 'хуй', 'test', 'player', 'Сука', 'СУКА', 'сука123'];
  console.log('[bannedWords] Testing filter:');
  let failedTests = 0;
  testWords.forEach(word => {
    const result = containsBannedWords(word);
    const shouldBlock = ['сука', 'блять', 'хуй', 'Сука', 'СУКА', 'сука123'].includes(word);
    const status = result ? 'BLOCKED ✓' : 'ALLOWED';
    const expected = shouldBlock ? (result ? '✓ CORRECT' : '✗ FAILED - SHOULD BLOCK!') : '';
    console.log(`[bannedWords] "${word}": ${status} ${expected}`);
    if (shouldBlock && !result) {
      console.error(`[bannedWords] CRITICAL: Word "${word}" should be blocked but is not!`);
      failedTests++;
    }
  });
  if (failedTests > 0) {
    console.error(`[bannedWords] WARNING: ${failedTests} test(s) failed!`);
  } else {
    console.log('[bannedWords] All tests passed!');
  }
} else {
  console.error('[bannedWords] ERROR: No banned words loaded!');
}

// Отслеживаем изменения файла заданий
fs.watch(QUESTS_PATH, { persistent: false }, () => {
  console.log('[quests] Reloading due to file change...');
  questsData = loadQuests();
});

// Отслеживаем изменения файла запрещенных слов
fs.watch(BANNED_WORDS_PATH, { persistent: false }, () => {
  console.log('[bannedWords] Reloading due to file change...');
  bannedWords = loadBannedWords();
});

// Хранилище использованных ников (в памяти, можно перенести в БД)
const usedAliases = new Set();
let manifestById = new Map();
let shuffledQueue = [];

updateManifest(imageManifest);

fs.watch(MANIFEST_PATH, { persistent: false }, () => {
  console.log('[manifest] Reloading due to file change...');
  updateManifest(loadImageManifest());
});

const activeQuestions = new Map();

function updateManifest(manifest) {
  imageManifest = manifest;
  manifestById = new Map(imageManifest.map((item) => [item.id, item]));
  shuffledQueue = shuffleIds(imageManifest);
}

function garbageCollectQuestions() {
  const now = Date.now();
  const cutoff = now - MAX_SINGLE_CACHE_MINUTES * 60_000;
  for (const [id, meta] of activeQuestions.entries()) {
    if (meta.createdAt < cutoff) {
      activeQuestions.delete(id);
    }
  }
}
setInterval(garbageCollectQuestions, 60_000).unref?.();

function shuffleIds(list) {
  const ids = list.map((item) => item.id);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

function drawNextImage(meta = {}) {
  if (imageManifest.length === 0) {
    throw new Error('Image manifest is empty');
  }
  const maxAttempts = Math.max(shuffledQueue.length, imageManifest.length) + 5;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (shuffledQueue.length === 0) {
      shuffledQueue = shuffleIds(imageManifest);
    }
    const candidateId = shuffledQueue.shift();
    const candidate = manifestById.get(candidateId);
    if (!candidate) {
      continue;
    }
    if (meta.excludeTypes && meta.excludeTypes.includes(candidate.type)) {
      shuffledQueue.push(candidate.id);
      continue;
    }
    if (meta.excludeIds && meta.excludeIds.includes(candidate.id)) {
      shuffledQueue.push(candidate.id);
      continue;
    }
    return candidate;
  }
  // If we didn't find a suitable candidate due to filters, ignore filters once.
  if (shuffledQueue.length === 0) {
    shuffledQueue = shuffleIds(imageManifest);
  }
  const fallbackId = shuffledQueue.shift();
  return manifestById.get(fallbackId) ?? imageManifest[0];
}

function createQuestion(meta = {}) {
  const datasetItem = drawNextImage(meta);

  const questionId = uuid();
  const stored = {
    answer: datasetItem.type,
    imageId: datasetItem.id,
    createdAt: Date.now(),
    payload: datasetItem,
  };
  activeQuestions.set(questionId, stored);

  return {
    questionId,
    imageUrl: datasetItem.url,
    prompt: datasetItem.prompt ?? null,
    attribution: datasetItem.attribution ?? null,
    source: datasetItem.source ?? null,
  };
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, manifestSize: imageManifest.length });
});

app.get('/api/questions/single', (_req, res) => {
  try {
    const question = createQuestion();
    res.json({ question });
  } catch (error) {
    console.error('[single] Failed to create question:', error);
    res.status(500).json({ error: 'unable_to_generate_question' });
  }
});

app.get('/api/questions/batch', (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count || '10', 10), 20); // Максимум 20 вопросов
    const excludeIds = req.query.excludeIds ? JSON.parse(req.query.excludeIds) : undefined;
    const questions = [];
    const usedImageIds = new Set(excludeIds || []);
    
    for (let i = 0; i < count; i++) {
      const question = createQuestion({ excludeIds: Array.from(usedImageIds) });
      questions.push(question);
      const stored = activeQuestions.get(question.questionId);
      if (stored?.imageId) {
        usedImageIds.add(stored.imageId);
      }
    }
    
    res.json({ questions });
  } catch (error) {
    console.error('[batch] Failed to create questions:', error);
    res.status(500).json({ error: 'unable_to_generate_questions' });
  }
});

app.post('/api/questions/single/:questionId/answer', (req, res) => {
  const { questionId } = req.params;
  const { answer } = req.body ?? {};
  if (!answer || !['real', 'ai'].includes(answer)) {
    return res.status(400).json({ error: 'invalid_answer' });
  }
  const stored = activeQuestions.get(questionId);
  if (!stored) {
    return res.status(404).json({ error: 'question_not_found' });
  }

  activeQuestions.delete(questionId);
  const correct = stored.answer === answer;
  let nextQuestion = null;
  try {
    nextQuestion = createQuestion({ excludeIds: [stored.imageId] });
  } catch (error) {
    console.error('[single] Failed to create next question:', error);
  }

  res.json({
    correct,
    correctAnswer: stored.answer,
    nextQuestion,
    imageMeta: {
      id: stored.imageId,
      source: stored.payload?.source ?? null,
      attribution: stored.payload?.attribution ?? null,
    },
  });
});

app.get('/api/meta/sources', (_req, res) => {
  const sources = imageManifest.reduce((acc, item) => {
    const key = item.source?.name ?? 'Unknown';
    if (!acc[key]) {
      acc[key] = { count: 0, sample: item.url, license: item.license ?? null };
    }
    acc[key].count += 1;
    return acc;
  }, {});
  res.json({ sources });
});

// Функция для получения начала недели (понедельник)
function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Понедельник = 1
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Простой детерминированный генератор случайных чисел на основе seed
function seededRandom(seed) {
  let value = seed;
  return function() {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

// Функция для получения начала дня
function getDayStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Выбор случайных заданий из пула на основе недели
function selectWeeklyChallenges(pool, count = 3) {
  if (!pool || !Array.isArray(pool) || pool.length === 0) {
    return [];
  }
  
  const weekStart = getWeekStart();
  // Используем timestamp начала недели как seed для детерминированного выбора
  const seed = Math.floor(weekStart.getTime() / (1000 * 60 * 60 * 24 * 7));
  const random = seededRandom(seed);
  
  // Создаем копию пула и перемешиваем детерминированно
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  // Возвращаем первые count заданий
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Выбор случайных мини-целей из пула на основе дня
function selectMiniGoals(pool, count = 5) {
  if (!pool || !Array.isArray(pool) || pool.length === 0) {
    return [];
  }
  
  const dayStart = getDayStart();
  // Используем timestamp начала дня как seed для детерминированного выбора
  const seed = Math.floor(dayStart.getTime() / (1000 * 60 * 60 * 24));
  const random = seededRandom(seed);
  
  // Создаем копию пула и перемешиваем детерминированно
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  // Возвращаем первые count заданий
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Тестовый эндпоинт для проверки загрузки запрещенных слов (удалить в production)
app.get('/api/debug/banned-words', (_req, res) => {
  try {
    res.json({
      count: bannedWords ? bannedWords.length : 0,
      hasSuka: bannedWords ? bannedWords.includes('сука') : false,
      hasBlyat: bannedWords ? bannedWords.includes('блять') : false,
      first10: bannedWords ? bannedWords.slice(0, 10) : [],
      testSuka: containsBannedWords('сука'),
      testBlyat: containsBannedWords('блять'),
      testPlayer: containsBannedWords('player'),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API для проверки доступности ника
app.get('/api/alias/check', (req, res) => {
  try {
    const alias = req.query.alias;
    if (!alias || typeof alias !== 'string') {
      return res.status(400).json({ error: 'alias_required' });
    }
    
    console.log(`[alias/check] Checking alias: "${alias}"`);
    console.log(`[alias/check] Banned words count: ${bannedWords ? bannedWords.length : 0}`);
    console.log(`[alias/check] Has "сука" in list: ${bannedWords ? bannedWords.includes('сука') : false}`);
    
    // Проверяем напрямую
    const hasBanned = containsBannedWords(alias);
    console.log(`[alias/check] containsBannedWords("${alias}") = ${hasBanned}`);
    
    if (hasBanned) {
      console.log(`[alias/check] BLOCKED: "${alias}" contains banned words`);
      return res.json({ available: false, error: 'Имя содержит недопустимые слова' });
    }
    
    const validation = validateAlias(alias);
    console.log(`[alias/check] Validation result:`, validation.valid ? 'VALID' : `INVALID - ${validation.error}`);
    
    if (!validation.valid) {
      return res.json({ available: false, error: validation.error });
    }
    
    return res.json({ available: true });
  } catch (error) {
    console.error('[alias] Failed to check alias:', error);
    res.status(500).json({ error: 'unable_to_check_alias' });
  }
});

// API для получения заданий (динамическая загрузка)
app.get('/api/quests', (_req, res) => {
  try {
    if (!questsData) {
      console.warn('[quests] questsData is null, returning 503');
      return res.status(503).json({ error: 'quests_not_available' });
    }
    
    // Автоматически выбираем еженедельные задания из пула
    const weeklyChallengesPool = questsData.weeklyChallengesPool || questsData.weeklyChallenges || [];
    const weeklyChallenges = selectWeeklyChallenges(weeklyChallengesPool, 3);
    
    // Автоматически выбираем мини-цели из пула (каждый день новые)
    const miniGoalsPool = questsData.miniGoalsPool || questsData.miniGoals || [];
    const miniGoals = selectMiniGoals(miniGoalsPool, 5);
    
    // Возвращаем задания с версией для кэширования на клиенте
    const response = {
      version: questsData.version || 1,
      lastUpdated: questsData.lastUpdated || new Date().toISOString(),
      weekStart: getWeekStart().toISOString(), // Для информации о текущей неделе
      dayStart: getDayStart().toISOString(), // Для информации о текущем дне
      dailyQuests: questsData.dailyQuests || [],
      weeklyChallenges: weeklyChallenges,
      miniGoals: miniGoals,
    };
    
    res.json(response);
  } catch (error) {
    console.error('[quests] Failed to serve quests:', error);
    res.status(500).json({ error: 'unable_to_load_quests' });
  }
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });

const waitingPlayers = [];
const matches = new Map();
const players = new Map(); // Хранилище всех активных игроков по ID

function broadcast(match, event) {
  match.players.forEach((player) => {
    if (player.socket.readyState === player.socket.OPEN) {
      player.socket.send(JSON.stringify(event));
    }
  });
}

function endMatch(match, reason) {
  if (match.ended) return;
  match.ended = true;
  clearQuestionTimer(match);
  clearPendingNextQuestion(match);
  cleanupCurrentQuestion(match);
  const statsSnapshot = {};
  match.players.forEach((player) => {
    if (player.matchId === match.id) {
      player.matchId = null;
    }
    statsSnapshot[player.id] = { ...getPlayerStats(match, player.id) };
  });
  const payload = {
    ...reason,
    durationMs: Date.now() - match.createdAt,
    stats: statsSnapshot,
    totalQuestions: match.totalQuestions,
    targetScore: match.targetScore,
  };
  broadcast(match, { type: 'match-end', payload });
  matches.delete(match.id);
}

function startNextQuestion(match) {
  try {
    if (match.ended) return;
    // Исключаем все использованные изображения в этом матче
    const excludeIds = match.usedImageIds ? Array.from(match.usedImageIds) : [];
    const question = createQuestion({ excludeIds });
    match.currentQuestion = question;
    match.questionAnsweredBy = null;
    const stored = activeQuestions.get(question.questionId);
    const imageId = stored?.imageId ?? null;
    if (imageId) {
      // Добавляем в список использованных
      if (!match.usedImageIds) {
        match.usedImageIds = new Set();
      }
      match.usedImageIds.add(imageId);
      match.lastImageId = imageId;
    }
    match.totalQuestions += 1;
    clearQuestionTimer(match);
    
    // Сбрасываем флаги готовности игроков
    match.imageReadyPlayers = new Set();
    
    // Отправляем вопрос сразу
    broadcast(match, {
      type: 'question',
      payload: {
        matchId: match.id,
        question,
        timeLimitMs: QUESTION_TIME_LIMIT_MS,
      },
    });
    
    // Таймер начнется только после получения сигнала от обоих игроков
    // Но на случай, если кто-то не отправит сигнал, запускаем таймаут
    match.imageReadyTimeout = setTimeout(() => {
      if (match.ended || !match.currentQuestion) return;
      // Если не все игроки готовы, все равно запускаем таймер
      startQuestionTimer(match);
    }, 5000); // Максимум 5 секунд на загрузку
  } catch (error) {
    console.error('[multiplayer] Failed to start next question:', error);
    endMatch(match, { reason: 'error', message: 'Failed to generate question' });
  }
}

function startQuestionTimer(match) {
  if (match.ended || !match.currentQuestion) return;
  if (match.questionTimer) return; // Таймер уже запущен
  
  match.questionStart = Date.now();
  match.questionDeadline = match.questionStart + QUESTION_TIME_LIMIT_MS;
  match.questionTimer = setTimeout(() => handleQuestionTimeout(match), QUESTION_TIME_LIMIT_MS);
  
  // Отправляем deadline клиентам
  broadcast(match, {
    type: 'question-start',
    payload: {
      matchId: match.id,
      deadline: match.questionDeadline,
      timeLimitMs: QUESTION_TIME_LIMIT_MS,
    },
  });
}

function createMatch(playerA, playerB) {
  const match = {
    id: uuid(),
    players: [playerA, playerB],
    scores: new Map([
      [playerA.id, 0],
      [playerB.id, 0],
    ]),
    currentQuestion: null,
    targetScore: TARGET_SCORE,
    createdAt: Date.now(),
    lastImageId: null,
    usedImageIds: new Set(), // Все использованные изображения в матче
    questionTimer: null,
    pendingNextQuestion: null,
    questionStart: null,
    questionDeadline: null,
    imageReadyPlayers: new Set(),
    imageReadyTimeout: null,
    clientReadyPlayers: new Set(),
    startTimeout: null,
    stats: new Map([
      [playerA.id, { correct: 0, wrong: 0, totalTimeMs: 0 }],
      [playerB.id, { correct: 0, wrong: 0, totalTimeMs: 0 }],
    ]),
    totalQuestions: 0,
  };
  matches.set(match.id, match);
  playerA.matchId = match.id;
  playerB.matchId = match.id;

  broadcast(match, {
    type: 'match-start',
    payload: {
      matchId: match.id,
      players: match.players.map((player) => ({
        id: player.id,
        alias: player.alias,
      })),
      targetScore: match.targetScore,
    },
  });

  // Ждем готовности обоих клиентов перед началом первого вопроса
  match.clientReadyPlayers = new Set();
  match.startTimeout = setTimeout(() => {
    // Если не все клиенты готовы за 10 секунд, начинаем все равно
    if (!match.ended && !match.currentQuestion) {
      startNextQuestion(match);
    }
  }, 10000);
}

function queueOrMatchPlayer(player) {
  if (waitingPlayers.length > 0) {
    const opponent = waitingPlayers.shift();
    createMatch(opponent, player);
  } else {
    waitingPlayers.push(player);
    player.socket.send(
      JSON.stringify({ type: 'queued', payload: { message: 'Waiting for another player...' } }),
    );
  }
}

function removeFromQueue(player) {
  const index = waitingPlayers.indexOf(player);
  if (index !== -1) {
    waitingPlayers.splice(index, 1);
  }
}

wss.on('connection', (socket) => {
  // Генерируем уникальное имя по умолчанию
  let defaultAlias;
  let attempts = 0;
  do {
    defaultAlias = `Игрок-${Math.floor(Math.random() * 9_000 + 1_000)}`;
    attempts++;
  } while (!isAliasAvailable(defaultAlias) && attempts < 100);
  
  // Если не удалось найти уникальное, добавляем timestamp
  if (!isAliasAvailable(defaultAlias)) {
    defaultAlias = `Игрок-${Date.now().toString().slice(-6)}`;
  }
  
  const player = {
    id: uuid(),
    alias: defaultAlias,
    socket,
    matchId: null,
  };
  
  // Регистрируем имя по умолчанию
  registerAlias(player.alias);
  players.set(player.id, player);

  socket.send(JSON.stringify({ type: 'connected', payload: { playerId: player.id, alias: player.alias } }));
  queueOrMatchPlayer(player);

  socket.on('message', (raw) => {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      socket.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message format' } }));
      return;
    }
    const { type, payload } = parsed;
    if (type === 'leave-queue') {
      removeFromQueue(player);
      socket.send(JSON.stringify({ type: 'queue-left' }));
      return;
    }
    if (type === 'join-queue') {
      if (player.matchId) {
        socket.send(JSON.stringify({ type: 'error', payload: { message: 'Already in a match' } }));
        return;
      }
      queueOrMatchPlayer(player);
      return;
    }
    if (type === 'set-alias') {
      const proposed = (payload?.alias ?? '').toString();
      const validation = validateAlias(proposed, player.alias);
      
      if (!validation.valid) {
        socket.send(JSON.stringify({ 
          type: 'error', 
          payload: { message: validation.error || 'Некорректное имя игрока' } 
        }));
        return;
      }
      
      // Если имя изменилось, обновляем реестр
      if (player.alias && player.alias.toLowerCase() !== validation.alias.toLowerCase()) {
        unregisterAlias(player.alias);
      }
      
      // Регистрируем новое имя
      registerAlias(validation.alias);
      player.alias = validation.alias;
      
      socket.send(JSON.stringify({ type: 'alias-updated', payload: { playerId: player.id, alias: player.alias } }));
      if (player.matchId) {
        const match = matches.get(player.matchId);
        if (match) {
          broadcast(match, { type: 'player-update', payload: { playerId: player.id, alias: player.alias } });
        }
      }
      return;
    }
    if (type === 'leave-match') {
      if (!player.matchId) {
        socket.send(JSON.stringify({ type: 'error', payload: { message: 'Not in a match' } }));
        return;
      }
      const match = matches.get(player.matchId);
      if (match) {
        endMatch(match, { reason: 'player_left', playerId: player.id });
      }
      player.matchId = null;
      return;
    }
    if (type === 'client-ready') {
      const { matchId } = payload ?? {};
      if (!matchId) {
        return;
      }
      const match = matches.get(matchId);
      if (!match) {
        return;
      }
      // Добавляем игрока в список готовых клиентов
      match.clientReadyPlayers.add(player.id);
      // Если оба клиента готовы и еще не начали игру, начинаем первый вопрос
      if (match.clientReadyPlayers.size >= match.players.length && !match.currentQuestion && !match.ended) {
        if (match.startTimeout) {
          clearTimeout(match.startTimeout);
          match.startTimeout = null;
        }
        startNextQuestion(match);
      }
      return;
    }
    if (type === 'image-ready') {
      const { matchId } = payload ?? {};
      if (!matchId) {
        socket.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid image-ready payload' } }));
        return;
      }
      const match = matches.get(matchId);
      if (!match) {
        socket.send(JSON.stringify({ type: 'error', payload: { message: 'Match not found' } }));
        return;
      }
      // Добавляем игрока в список готовых
      match.imageReadyPlayers.add(player.id);
      // Если оба игрока готовы, запускаем таймер
      if (match.imageReadyPlayers.size >= match.players.length && !match.questionTimer) {
        if (match.imageReadyTimeout) {
          clearTimeout(match.imageReadyTimeout);
          match.imageReadyTimeout = null;
        }
        startQuestionTimer(match);
      }
      return;
    }
    if (type === 'answer') {
      const { matchId, questionId, answer } = payload ?? {};
      if (!matchId || !questionId || !['real', 'ai'].includes(answer)) {
        socket.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid answer payload' } }));
        return;
      }
      const match = matches.get(matchId);
      if (!match) {
        socket.send(JSON.stringify({ type: 'error', payload: { message: 'Match not found' } }));
        return;
      }
      if (match.currentQuestion?.questionId !== questionId) {
        socket.send(JSON.stringify({ type: 'error', payload: { message: 'Question expired' } }));
        return;
      }
      const stored = activeQuestions.get(questionId);
      if (!stored) {
        socket.send(JSON.stringify({ type: 'error', payload: { message: 'Question missing' } }));
        return;
      }
      if (match.questionAnsweredBy) {
        socket.send(JSON.stringify({ type: 'info', payload: { message: 'Another player already answered correctly' } }));
        return;
      }
      const now = Date.now();
      if (match.questionDeadline && now > match.questionDeadline) {
        socket.send(JSON.stringify({ type: 'error', payload: { message: 'Question expired' } }));
        return;
      }
      const elapsed = Math.max(0, Math.min(now - (match.questionStart ?? now), QUESTION_TIME_LIMIT_MS));
      const correct = stored.answer === answer;
      if (correct) {
        match.questionAnsweredBy = player.id;
        bumpStats(match, player.id, { correct: 1, totalTimeMs: elapsed });
        const currentScore = match.scores.get(player.id) ?? 0;
        const newScore = currentScore + 1;
        match.scores.set(player.id, newScore);
        clearQuestionTimer(match);
        cleanupCurrentQuestion(match);
        broadcast(match, {
          type: 'answer-result',
          payload: {
            playerId: player.id,
            correct: true,
            correctAnswer: stored.answer,
            scores: Object.fromEntries(match.scores),
          },
        });
        if (newScore >= match.targetScore) {
          endMatch(match, { reason: 'completed', winner: player.id, scores: Object.fromEntries(match.scores) });
        } else {
          scheduleNextQuestion(match);
        }
      } else {
        bumpStats(match, player.id, { wrong: 1, totalTimeMs: elapsed });
        socket.send(JSON.stringify({
          type: 'answer-result',
          payload: {
            playerId: player.id,
            correct: false,
          },
        }));
        cleanupCurrentQuestion(match);
        broadcast(match, { type: 'question-complete', payload: { matchId: match.id } });
        scheduleNextQuestion(match);
      }
    }
  });

  socket.on('close', () => {
    removeFromQueue(player);
    if (player.matchId) {
      const match = matches.get(player.matchId);
      if (match) {
        const reason = { reason: 'player_disconnect', playerId: player.id };
        endMatch(match, reason);
      }
    }
    // Освобождаем ник при отключении игрока
    unregisterAlias(player.alias);
    players.delete(player.id);
  });
});

server.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
});

