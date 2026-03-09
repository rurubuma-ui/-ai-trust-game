const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : window.location.origin;
const WS_BASE = API_BASE.replace(/^http/, 'ws');

const tabs = document.querySelectorAll('.tab-button');
const panels = document.querySelectorAll('.panel');

const singleFrameEl = document.querySelector('#single-player .image-frame');
const singleResultChipEl = document.getElementById('single-result-chip');
const singleStatusEl = document.getElementById('single-status');
const mpFrameEl = document.querySelector('#multiplayer .image-frame');
const mpResultChipEl = document.getElementById('mp-result-chip');

const profileNameEl = document.getElementById('profile-name');
const profileLevelEl = document.getElementById('profile-level');
const profileXpTextEl = document.getElementById('profile-xp-text');
const profileXpBarEl = document.getElementById('profile-xp-bar');
const profileEditBtn = document.getElementById('profile-edit');
const profileAchievementsBtn = document.getElementById('profile-achievements');
const achievementsBackdrop = document.getElementById('achievements-backdrop');
const achievementsModal = document.getElementById('achievements-modal');
const achievementsListEl = document.getElementById('achievements-list');
const achievementsCloseBtn = document.getElementById('achievements-close');

const mpStatusEl = document.getElementById('mp-status');
const mpQueueBtn = document.getElementById('mp-queue-btn');
const mpMatchInfoEl = document.getElementById('mp-match-info');
const mpPlayerSelfEl = document.getElementById('mp-player-self');
const mpPlayerOpponentEl = document.getElementById('mp-player-opponent');
const mpScoreSelfEl = document.getElementById('mp-score-self');
const mpScoreOpponentEl = document.getElementById('mp-score-opponent');
const mpImageEl = document.getElementById('mp-image');
const mpFeedbackEl = document.getElementById('mp-feedback');
const mpTargetEl = document.getElementById('mp-target');
const mpTimerEl = document.getElementById('mp-timer');
const mpAnswerButtons = Array.from(document.querySelectorAll('#multiplayer .choice-button'));
const matchStatsBackdrop = document.getElementById('match-stats-backdrop');
const matchStatsModal = document.getElementById('match-stats-modal');
const matchStatsContent = document.getElementById('match-stats-content');
const matchStatsCloseBtn = document.getElementById('match-stats-close');

function setAnswerButtonsDisabled(isDisabled) {
  mpAnswerButtons.forEach((button) => {
    button.disabled = isDisabled;
  });
}

const mpState = {
  socket: null,
  playerId: null,
  alias: 'Гость',
  matchId: null,
  targetScore: 10,
  opponentId: null,
  scoreById: {},
  opponentAlias: 'Противник',
  currentQuestion: null,
  queued: false,
  questionDeadline: null,
  timerInterval: null,
  answeredThisRound: false,
  statsSnapshot: null,
  pendingDeadline: null, // Deadline, который будет установлен после загрузки изображения
  imageLoaded: false, // Флаг загрузки изображения
  preloadedQuestions: [], // Предзагруженные вопросы
  preloadedImages: new Map(), // Кэш загруженных изображений (URL -> Image)
};

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const targetId = tab.dataset.target;
    if (!targetId) {
      console.error('[tabs] No target ID found for tab');
      return;
    }
    tabs.forEach((t) => t.classList.toggle('active', t === tab));
    panels.forEach((panel) => {
      const isVisible = panel.id === targetId;
      panel.classList.toggle('visible', isVisible);
      if (isVisible && targetId === 'multiplayer' && !mpState.socket) {
        console.log('[tabs] Switching to multiplayer, connecting socket...');
        connectSocket();
      }
    });
  });
});

function setFrameHighlight(frameEl, state) {
  if (!frameEl) return;
  frameEl.classList.remove('success', 'error');
  if (state) {
    frameEl.classList.add(state);
  }
}

function showResultChip(chipEl, state, text) {
  if (!chipEl) return;
  chipEl.classList.remove('hidden', 'visible', 'success', 'error');
  if (!state) return;
  chipEl.textContent = text;
  chipEl.classList.add(state, 'visible');
}

function preloadImage(url, cache = mpState.preloadedImages) {
  return new Promise((resolve, reject) => {
    if (cache.has(url)) {
      const cached = cache.get(url);
      // Проверяем, что изображение полностью загружено и валидно
      if (cached.complete && cached.naturalWidth > 0 && cached.naturalHeight > 0) {
        // Дополнительная проверка: слишком маленькие изображения могут быть повреждены
        if (cached.naturalWidth >= 10 && cached.naturalHeight >= 10) {
          resolve(cached);
          return;
        } else {
          // Удаляем поврежденное изображение из кэша
          console.warn('[image] Cached image is corrupted, removing:', url);
          cache.delete(url);
        }
      }
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    // Устанавливаем приоритет загрузки для лучшей производительности
    if (img.fetchPriority !== undefined) {
      img.fetchPriority = 'high';
    }
    
    // Таймаут для загрузки (10 секунд)
    const timeout = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      reject(new Error(`Image load timeout: ${url}`));
    }, 10000);
    
    img.onload = () => {
      clearTimeout(timeout);
      // Проверяем валидность изображения
      if (img.naturalWidth > 0 && img.naturalHeight > 0 && img.complete) {
        // Проверка на поврежденные изображения (слишком маленькие)
        if (img.naturalWidth < 10 || img.naturalHeight < 10) {
          console.warn('[image] Image too small, possibly corrupted:', url);
          reject(new Error(`Image too small: ${url}`));
          return;
        }
        cache.set(url, img);
        resolve(img);
      } else {
        reject(new Error(`Image invalid after load: ${url}`));
      }
    };
    img.onerror = (error) => {
      clearTimeout(timeout);
      console.warn('[image] Failed to load image:', url, error);
      reject(new Error(`Failed to load image: ${url}`));
    };
    img.src = url;
  });
}

async function preloadQuestions(count = 10) {
  try {
    const excludeIds = Array.from(mpState.preloadedQuestions.map(q => {
      // Получаем imageId из вопроса, если возможно
      return null; // Пока не можем получить imageId без доступа к activeQuestions
    }).filter(Boolean));
    
    const excludeParam = excludeIds.length > 0 ? `&excludeIds=${JSON.stringify(excludeIds)}` : '';
    const response = await fetch(`${API_BASE}/api/questions/batch?count=${count}${excludeParam}`);
    if (!response.ok) throw new Error('Failed to fetch questions');
    const data = await response.json();
    
    mpState.preloadedQuestions.push(...data.questions);
    
    // Предзагружаем изображения в фоне параллельно с приоритетом
    // Загружаем первые 5 изображений с высоким приоритетом, остальные - в фоне
    const highPriorityCount = Math.min(5, data.questions.length);
    const highPriorityPromises = data.questions.slice(0, highPriorityCount).map(question => 
      preloadImage(question.imageUrl).catch(() => {})
    );
    const backgroundPromises = data.questions.slice(highPriorityCount).map(question => 
      preloadImage(question.imageUrl).catch(() => {})
    );
    
    // Сначала загружаем приоритетные, потом остальные
    await Promise.all(highPriorityPromises);
    // Остальные загружаем в фоне, не ждем их
    Promise.all(backgroundPromises).catch(() => {});
  } catch (error) {
    console.error('[preload] Failed to preload questions:', error);
  }
}

function beginImageLoad(imgEl, frameEl, url, onLoadCallback, imageCache = mpState.preloadedImages) {
  if (!imgEl || !frameEl || !url) return;
  
  // Устанавливаем приоритет загрузки для текущего изображения
  if (imgEl.fetchPriority !== undefined) {
    imgEl.fetchPriority = 'high';
  }
  if (imgEl.loading !== undefined) {
    imgEl.loading = 'eager';
  }
  
  // Проверяем, есть ли изображение в кэше
  const cachedImg = imageCache.get(url);
  if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0 && cachedImg.naturalHeight > 0) {
    // Дополнительная проверка на поврежденные изображения
    if (cachedImg.naturalWidth >= 10 && cachedImg.naturalHeight >= 10) {
      // Изображение уже загружено и валидно, используем его сразу
      imgEl.src = url;
      frameEl.classList.remove('loading', 'error');
      // Вызываем callback синхронно, если изображение уже в кэше
      if (onLoadCallback) {
        // Используем requestAnimationFrame для синхронизации
        requestAnimationFrame(() => {
          onLoadCallback();
        });
      }
      return;
    } else {
      // Удаляем поврежденное изображение из кэша
      console.warn('[image] Cached image is corrupted, removing:', url);
      imageCache.delete(url);
    }
  }
  
  const token = `${Date.now()}-${Math.random()}`;
  imgEl.dataset.loadingToken = token;
  frameEl.classList.add('loading');
  
  // Проверяем, загружается ли уже это изображение
  if (cachedImg && !cachedImg.complete) {
    // Изображение уже загружается, ждем его
    cachedImg.onload = () => {
      if (imgEl.dataset.loadingToken === token) {
        imageCache.set(url, cachedImg);
        imgEl.src = url;
        frameEl.classList.remove('loading');
        delete imgEl.dataset.loadingToken;
        if (onLoadCallback) {
          onLoadCallback();
        }
      }
    };
    cachedImg.onerror = () => {
      if (imgEl.dataset.loadingToken === token) {
        frameEl.classList.remove('loading');
        delete imgEl.dataset.loadingToken;
        if (onLoadCallback) {
          onLoadCallback();
        }
      }
    };
    return;
  }
  
  // Загружаем новое изображение
  const img = new Image();
  if (img.fetchPriority !== undefined) {
    img.fetchPriority = 'high';
  }
  // Таймаут для загрузки (8 секунд)
  const timeout = setTimeout(() => {
    if (imgEl.dataset.loadingToken === token) {
      console.warn('[image] Image load timeout:', url);
      frameEl.classList.remove('loading');
      frameEl.classList.add('error');
      delete imgEl.dataset.loadingToken;
      if (onLoadCallback) {
        onLoadCallback();
      }
    }
    img.onload = null;
    img.onerror = null;
  }, 8000);
  
  img.onload = () => {
    clearTimeout(timeout);
    if (imgEl.dataset.loadingToken === token) {
      // Проверяем валидность изображения
      if (img.naturalWidth > 0 && img.naturalHeight > 0 && img.complete) {
        // Проверка на поврежденные изображения (слишком маленькие)
        if (img.naturalWidth < 10 || img.naturalHeight < 10) {
          console.warn('[image] Image too small, possibly corrupted:', url);
          frameEl.classList.remove('loading');
          frameEl.classList.add('error');
          delete imgEl.dataset.loadingToken;
          if (onLoadCallback) {
            onLoadCallback();
          }
          return;
        }
        // Изображение валидно, сохраняем в кэш
        imageCache.set(url, img);
        imgEl.src = url;
        frameEl.classList.remove('loading', 'error');
        delete imgEl.dataset.loadingToken;
        if (onLoadCallback) {
          onLoadCallback();
        }
      } else {
        console.warn('[image] Image invalid after load:', url);
        frameEl.classList.remove('loading');
        frameEl.classList.add('error');
        delete imgEl.dataset.loadingToken;
        if (onLoadCallback) {
          onLoadCallback();
        }
      }
    }
  };
  img.onerror = (error) => {
    clearTimeout(timeout);
    if (imgEl.dataset.loadingToken === token) {
      console.warn('[image] Failed to load image:', url, error);
      frameEl.classList.remove('loading');
      frameEl.classList.add('error');
      delete imgEl.dataset.loadingToken;
      // Даже при ошибке вызываем callback, чтобы таймер запустился
      if (onLoadCallback) {
        onLoadCallback();
      }
    }
  };
  img.crossOrigin = 'anonymous';
  img.src = url;
}

function showAchievementToast(meta) {
  if (!toastContainer || !meta) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <strong>${meta.title}</strong>
    <span>${meta.description}</span>
    <span class="toast-xp">+${meta.xp} XP</span>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.classList.add('hide'), 4000);
  setTimeout(() => toast.remove(), 4400);
  updateAchievementsSummary();
}

let currentAchievementCategory = 'all';

function getAchievementsData(category = currentAchievementCategory) {
  if (typeof profileManager.getAchievementsList !== 'function') return [];
  return profileManager.getAchievementsList(category);
}

function renderAchievementsList(items, category = 'all') {
  if (!achievementsListEl) return;
  achievementsListEl.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Нет достижений в этой категории.';
    empty.style.textAlign = 'center';
    empty.style.padding = '2rem';
    empty.style.color = '#94a3b8';
    achievementsListEl.appendChild(empty);
    return;
  }
  
  // Группируем по категориям, если показываем все
  if (category === 'all') {
    const byCategory = {};
    items.forEach((item) => {
      if (!byCategory[item.category]) {
        byCategory[item.category] = [];
      }
      byCategory[item.category].push(item);
    });
    
    // Показываем все категории с заголовками
    Object.entries(byCategory).forEach(([cat, catItems]) => {
      const categoryHeader = document.createElement('div');
      categoryHeader.className = 'achievement-category-header';
      const catInfo = profileManager.ACHIEVEMENT_CATEGORIES?.[cat] || { name: cat, icon: '⭐', color: '#94a3b8' };
      const unlocked = catItems.filter(i => i.unlocked).length;
      categoryHeader.innerHTML = `
        <span class="category-icon">${catInfo.icon}</span>
        <span class="category-name">${catInfo.name}</span>
        <span class="category-progress">${unlocked}/${catItems.length}</span>
      `;
      achievementsListEl.appendChild(categoryHeader);
      
      catItems.forEach((item) => {
        achievementsListEl.appendChild(createAchievementEntry(item));
      });
    });
  } else {
    // Показываем только выбранную категорию
    items.forEach((item) => {
      achievementsListEl.appendChild(createAchievementEntry(item));
    });
  }
}

function createAchievementEntry(item) {
  const entry = document.createElement('div');
  entry.className = `achievement-entry${item.unlocked ? ' unlocked' : ''}${item.rare ? ' rare' : ''}`;
  
  const catInfo = profileManager.ACHIEVEMENT_CATEGORIES?.[item.category] || { icon: '⭐', color: '#94a3b8' };
  const levelBadge = item.level > 1 ? `<span class="achievement-level">Ур. ${item.level}</span>` : '';
  const rareBadge = item.rare ? '<span class="achievement-rare">💎 Редкое</span>' : '';
  
  entry.innerHTML = `
    <div class="achievement-icon" style="background: ${item.unlocked ? catInfo.color : 'rgba(148, 163, 184, 0.3)'}">
      ${item.unlocked ? catInfo.icon : '○'}
    </div>
    <div class="achievement-info">
      <div class="achievement-header">
        <h3>${item.title}</h3>
        ${levelBadge}
        ${rareBadge}
      </div>
      <p>${item.description}</p>
      <div class="achievement-footer">
        <span class="achievement-xp">+${item.xp} XP</span>
        ${item.unlocked && item.unlockedAt ? `<span class="achievement-date">${new Date(item.unlockedAt).toLocaleDateString('ru-RU')}</span>` : ''}
      </div>
    </div>
  `;
  return entry;
}

function updateAchievementsSummary() {
  if (!profileAchievementsBtn) return;
  const achievements = getAchievementsData('all');
  if (!achievements.length) {
    profileAchievementsBtn.textContent = 'Очивки';
    profileAchievementsBtn.disabled = true;
    return;
  }
  const unlocked = achievements.filter((item) => item.unlocked).length;
  profileAchievementsBtn.textContent = `Очивки (${unlocked}/${achievements.length})`;
  profileAchievementsBtn.disabled = false;
  if (achievementsModal && !achievementsModal.classList.contains('hidden')) {
    renderAchievementsList(achievements, currentAchievementCategory);
  }
}

function openAchievementsModal() {
  if (!achievementsModal || !achievementsBackdrop) return;
  closeProfileSidebar(); // Закрываем sidebar при открытии модального окна
  achievementsBackdrop.classList.remove('hidden');
  achievementsModal.classList.remove('hidden');
  renderAchievementsList(getAchievementsData(currentAchievementCategory), currentAchievementCategory);
}

function closeAchievementsModal() {
  if (!achievementsModal || !achievementsBackdrop) return;
  achievementsBackdrop.classList.add('hidden');
  achievementsModal.classList.add('hidden');
}

function updateInlineStatus(el, state, text) {
  if (!el) return;
  el.classList.remove('visible', 'success', 'error');
  if (!state) {
    el.textContent = '';
    return;
  }
  el.textContent = text;
  el.classList.add('visible', state);
}

// Single player logic
const singleState = {
  question: null,
  score: 0,
  best: Number(window.localStorage.getItem('single-best-score') ?? 0),
  isBusy: false,
  nextQuestionTimer: null,
  preloadedQuestions: [],
  preloadedImages: new Map(),
};

const singleScoreEl = document.getElementById('single-score');
const singleBestEl = document.getElementById('single-best');
const singleImageEl = document.getElementById('single-image');
const singleFeedbackEl = document.getElementById('single-feedback');
const singleSourceEl = document.getElementById('single-source');
const toastContainer = document.getElementById('toast-container');

singleBestEl.textContent = singleState.best;

const profileManager = (() => {
  const STORAGE_KEY = 'profile-state-v3';
  const LEGACY_KEYS = ['profile-state-v2', 'profile-state-v1'];
  const XP_SINGLE_CORRECT = 1;
  const XP_DUEL_CORRECT = 2;
  const XP_DUEL_WIN = 12;
  const XP_BASE = 50;
  const XP_STEP = 25;

  // Категории достижений
  const ACHIEVEMENT_CATEGORIES = {
    wins: { name: 'Победы', icon: '🏆', color: '#fbbf24' },
    correct: { name: 'Точность', icon: '🎯', color: '#34d399' },
    streak: { name: 'Серии', icon: '🔥', color: '#f87171' },
    level: { name: 'Уровни', icon: '⭐', color: '#a78bfa' },
    rare: { name: 'Редкие', icon: '💎', color: '#60a5fa' },
    special: { name: 'Особые', icon: '✨', color: '#f472b6' },
  };

  const ACHIEVEMENTS = {
    // === КАТЕГОРИЯ: ПОБЕДЫ (Прогрессивные уровни) ===
    wins_1: {
      title: 'Первый триумф',
      description: 'Выиграйте свою первую дуэль',
      xp: 40,
      category: 'wins',
      level: 1,
      condition: (stats) => stats.duelWins >= 1,
    },
    wins_5: {
      title: 'Пятерка побед',
      description: 'Одержите 5 побед в дуэлях',
      xp: 80,
      category: 'wins',
      level: 2,
      condition: (stats) => stats.duelWins >= 5,
    },
    wins_10: {
      title: 'Десять побед',
      description: 'Одержите 10 побед в дуэлях',
      xp: 120,
      category: 'wins',
      level: 3,
      condition: (stats) => stats.duelWins >= 10,
    },
    wins_25: {
      title: 'Четверть сотни',
      description: 'Одержите 25 побед в дуэлях',
      xp: 200,
      category: 'wins',
      level: 4,
      condition: (stats) => stats.duelWins >= 25,
    },
    wins_50: {
      title: 'Полвека побед',
      description: 'Одержите 50 побед в дуэлях',
      xp: 300,
      category: 'wins',
      level: 5,
      condition: (stats) => stats.duelWins >= 50,
    },
    wins_100: {
      title: 'Сотня побед',
      description: 'Одержите 100 побед в дуэлях',
      xp: 500,
      category: 'wins',
      level: 6,
      condition: (stats) => stats.duelWins >= 100,
    },
    wins_200: {
      title: 'Двухсотка',
      description: 'Одержите 200 побед в дуэлях',
      xp: 800,
      category: 'wins',
      level: 7,
      condition: (stats) => stats.duelWins >= 200,
    },
    wins_500: {
      title: 'Легенда дуэлей',
      description: 'Одержите 500 побед в дуэлях',
      xp: 1500,
      category: 'wins',
      level: 8,
      rare: true,
      condition: (stats) => stats.duelWins >= 500,
    },

    // === КАТЕГОРИЯ: ТОЧНОСТЬ (Прогрессивные уровни) ===
    correct_1: {
      title: 'Первые шаги',
      description: 'Дай свой первый правильный ответ',
      xp: 10,
      category: 'correct',
      level: 1,
      condition: (stats) => stats.totalCorrect >= 1,
    },
    correct_10: {
      title: 'Десятка точных',
      description: 'Дайте 10 верных ответов',
      xp: 30,
      category: 'correct',
      level: 2,
      condition: (stats) => stats.totalCorrect >= 10,
    },
    correct_50: {
      title: 'Полсотни точных',
      description: 'Дайте 50 верных ответов',
      xp: 80,
      category: 'correct',
      level: 3,
      condition: (stats) => stats.totalCorrect >= 50,
    },
    correct_100: {
      title: 'Сотня точных',
      description: 'Дайте 100 верных ответов',
      xp: 180,
      category: 'correct',
      level: 4,
      condition: (stats) => stats.totalCorrect >= 100,
    },
    correct_250: {
      title: 'Четверть тысячи',
      description: 'Дайте 250 верных ответов',
      xp: 300,
      category: 'correct',
      level: 5,
      condition: (stats) => stats.totalCorrect >= 250,
    },
    correct_500: {
      title: 'Мастер точности',
      description: 'Дайте 500 верных ответов',
      xp: 400,
      category: 'correct',
      level: 6,
      condition: (stats) => stats.totalCorrect >= 500,
    },
    correct_1000: {
      title: 'Легенда точности',
      description: 'Дайте 1000 верных ответов',
      xp: 600,
      category: 'correct',
      level: 7,
      condition: (stats) => stats.totalCorrect >= 1000,
    },
    correct_2500: {
      title: 'Великий мастер',
      description: 'Дайте 2500 верных ответов',
      xp: 1000,
      category: 'correct',
      level: 8,
      rare: true,
      condition: (stats) => stats.totalCorrect >= 2500,
    },
    correct_5000: {
      title: 'Абсолютная точность',
      description: 'Дайте 5000 верных ответов',
      xp: 2000,
      category: 'correct',
      level: 9,
      rare: true,
      condition: (stats) => stats.totalCorrect >= 5000,
    },

    // === КАТЕГОРИЯ: СЕРИИ (Прогрессивные уровни) ===
    streak_5: {
      title: 'Горячая пятерка',
      description: '5 правильных ответов подряд',
      xp: 25,
      category: 'streak',
      level: 1,
      condition: (stats) => stats.bestStreak >= 5,
    },
    streak_10: {
      title: 'Горячая серия',
      description: '10 правильных ответов подряд',
      xp: 50,
      category: 'streak',
      level: 2,
      condition: (stats) => stats.bestStreak >= 10,
    },
    streak_20: {
      title: 'Невероятная серия',
      description: '20 правильных ответов подряд',
      xp: 100,
      category: 'streak',
      level: 3,
      condition: (stats) => stats.bestStreak >= 20,
    },
    streak_30: {
      title: 'Феноменальная серия',
      description: '30 правильных ответов подряд',
      xp: 150,
      category: 'streak',
      level: 4,
      condition: (stats) => stats.bestStreak >= 30,
    },
    streak_50: {
      title: 'Легендарная серия',
      description: '50 правильных ответов подряд',
      xp: 250,
      category: 'streak',
      level: 5,
      condition: (stats) => stats.bestStreak >= 50,
    },
    streak_75: {
      title: 'Невероятная серия',
      description: '75 правильных ответов подряд',
      xp: 400,
      category: 'streak',
      level: 6,
      rare: true,
      condition: (stats) => stats.bestStreak >= 75,
    },
    streak_100: {
      title: 'Сотня подряд',
      description: '100 правильных ответов подряд',
      xp: 600,
      category: 'streak',
      level: 7,
      rare: true,
      condition: (stats) => stats.bestStreak >= 100,
    },

    // === КАТЕГОРИЯ: УРОВНИ (Прогрессивные уровни) ===
    level_3: {
      title: 'Новичок',
      description: 'Достигните 3 уровня',
      xp: 50,
      category: 'level',
      level: 1,
      condition: (stats) => stats.level >= 3,
    },
    level_5: {
      title: 'Опытный игрок',
      description: 'Достигните 5 уровня',
      xp: 100,
      category: 'level',
      level: 2,
      condition: (stats) => stats.level >= 5,
    },
    level_10: {
      title: 'Ветеран',
      description: 'Достигните 10 уровня',
      xp: 200,
      category: 'level',
      level: 3,
      condition: (stats) => stats.level >= 10,
    },
    level_15: {
      title: 'Эксперт',
      description: 'Достигните 15 уровня',
      xp: 300,
      category: 'level',
      level: 4,
      condition: (stats) => stats.level >= 15,
    },
    level_20: {
      title: 'Мастер',
      description: 'Достигните 20 уровня',
      xp: 400,
      category: 'level',
      level: 5,
      condition: (stats) => stats.level >= 20,
    },
    level_25: {
      title: 'Гранд-мастер',
      description: 'Достигните 25 уровня',
      xp: 600,
      category: 'level',
      level: 6,
      condition: (stats) => stats.level >= 25,
    },
    level_30: {
      title: 'Легенда',
      description: 'Достигните 30 уровня',
      xp: 1000,
      category: 'level',
      level: 7,
      rare: true,
      condition: (stats) => stats.level >= 30,
    },
    level_50: {
      title: 'Божество',
      description: 'Достигните 50 уровня',
      xp: 2500,
      category: 'level',
      level: 8,
      rare: true,
      condition: (stats) => stats.level >= 50,
    },

    // === КАТЕГОРИЯ: РЕДКИЕ/ОСОБЫЕ ===
    flawless: {
      title: 'Идеальный раунд',
      description: 'Выиграйте дуэль без ошибок',
      xp: 80,
      category: 'rare',
      level: 1,
      condition: (stats) => Boolean(stats.lastMatchFlawless),
      ephemeral: true,
    },
    flawless_5: {
      title: 'Пять идеальных',
      description: 'Выиграйте 5 дуэлей без ошибок',
      xp: 200,
      category: 'rare',
      level: 2,
      condition: (stats) => (stats.flawlessWins || 0) >= 5,
    },
    flawless_10: {
      title: 'Десять идеальных',
      description: 'Выиграйте 10 дуэлей без ошибок',
      xp: 400,
      category: 'rare',
      level: 3,
      rare: true,
      condition: (stats) => (stats.flawlessWins || 0) >= 10,
    },
    hundredDuels: {
      title: 'Закалённый боец',
      description: 'Сыграйте 100 дуэлей',
      xp: 150,
      category: 'rare',
      level: 1,
      condition: (stats) => (stats.duelWins || 0) + (stats.duelLosses || 0) >= 100,
    },
    fiveHundredDuels: {
      title: 'Ветеран арены',
      description: 'Сыграйте 500 дуэлей',
      xp: 500,
      category: 'rare',
      level: 2,
      condition: (stats) => (stats.duelWins || 0) + (stats.duelLosses || 0) >= 500,
    },
    thousandDuels: {
      title: 'Мастер арены',
      description: 'Сыграйте 1000 дуэлей',
      xp: 1000,
      category: 'rare',
      level: 3,
      rare: true,
      condition: (stats) => (stats.duelWins || 0) + (stats.duelLosses || 0) >= 1000,
    },
    perfectDay: {
      title: 'Идеальный день',
      description: 'Выиграйте 10 дуэлей за один день',
      xp: 300,
      category: 'rare',
      level: 1,
      rare: true,
      condition: (stats) => (stats.dailyWins?.count || 0) >= 10,
    },
    comeback: {
      title: 'Возвращение',
      description: 'Выиграйте дуэль, проигрывая 0:5',
      xp: 250,
      category: 'rare',
      level: 1,
      rare: true,
      condition: (stats) => Boolean(stats.lastMatchComeback),
      ephemeral: true,
    },
    speedDemon: {
      title: 'Скоростной демон',
      description: 'Ответьте правильно за 0.5 секунды',
      xp: 150,
      category: 'rare',
      level: 1,
      rare: true,
      condition: (stats) => Boolean(stats.lastMatchSpeedDemon),
      ephemeral: true,
    },
    undefeated: {
      title: 'Непобедимый',
      description: 'Выиграйте 20 дуэлей подряд',
      xp: 800,
      category: 'rare',
      level: 2,
      rare: true,
      condition: (stats) => (stats.currentWinStreak || 0) >= 20,
    },
  };

  const listeners = new Set();
  const achievementListeners = new Set();
  let isReady = false;
  let pendingXp = 0;

  const state = {
    alias: 'Гость',
    totalXp: 0,
    level: 1,
    xpIntoLevel: 0,
    xpToNext: XP_BASE,
    rating: 1000, // ELO рейтинг, старт с 1000
    rank: 'Новичок',
    stats: {
      singleCorrect: 0,
      duelCorrect: 0,
      duelWrong: 0,
      duelWins: 0,
      duelLosses: 0,
      duelMatches: 0,
      totalCorrect: 0,
      bestStreak: 0,
      lastMatchFlawless: false,
      totalAnswers: 0,
      totalTimeMs: 0,
      avgResponseTime: 0,
    },
    achievements: {},
    dailyQuests: {},
    dailyBonus: { lastClaim: null, streak: 0 },
    weeklyChallenges: {},
    miniGoals: [],
    activeXpMultiplier: 1.0,
    xpMultiplierExpiresAt: null,
    currentStreak: 0,
    streakMultiplier: 1.0,
    customization: {
      avatar: 'default',
      frame: 'default',
      theme: 'default',
      badge: null,
    },
    friends: [],
    matchHistory: [],
  };

  const platform = {
    ysdk: null,
    player: null,
    async init() {
      if (typeof window !== 'undefined' && typeof window.YaGames === 'function') {
        try {
          this.ysdk = await window.YaGames.init();
          this.player = await this.ysdk.getPlayer({ scopes: false });
          const data = await this.player.getData(['alias', 'totalXp', 'stats', 'achievements']);
          applyLoadedData(data);
          return true;
        } catch (error) {
          console.warn('[profile] YaGames init failed', error);
        }
      }
      return false;
    },
    async save(payload) {
      if (!this.player) return false;
      try {
        await this.player.setData(payload, true);
        return true;
      } catch (error) {
        console.warn('[profile] Failed to persist to YaGames', error);
        return false;
      }
    },
  };

  function applyLoadedData(data) {
    if (!data) return;
    if (data.alias) {
      state.alias = sanitizeAlias(data.alias) || state.alias;
    } else if (platform.player && typeof platform.player.getName === 'function') {
      state.alias = sanitizeAlias(platform.player.getName()) || state.alias;
    }
    if (Number.isFinite(data.totalXp)) {
      state.totalXp = Math.max(0, Number(data.totalXp));
    }
    if (data.stats && typeof data.stats === 'object') {
      Object.assign(state.stats, data.stats);
    }
    if (Array.isArray(data.achievements)) {
      data.achievements.forEach((key) => {
        state.achievements[key] = { unlockedAt: Date.now() };
      });
    } else if (data.achievements && typeof data.achievements === 'object') {
      state.achievements = { ...data.achievements };
    }
    if (Number.isFinite(data.rating)) {
      state.rating = Math.max(0, Number(data.rating));
      state.rank = calculateRank(state.rating);
    }
    if (data.dailyQuests && typeof data.dailyQuests === 'object') {
      state.dailyQuests = { ...state.dailyQuests, ...data.dailyQuests };
    }
    if (data.dailyBonus && typeof data.dailyBonus === 'object') {
      state.dailyBonus = { ...state.dailyBonus, ...data.dailyBonus };
    }
    if (data.weeklyChallenges && typeof data.weeklyChallenges === 'object') {
      state.weeklyChallenges = { ...state.weeklyChallenges, ...data.weeklyChallenges };
    }
    if (Array.isArray(data.miniGoals)) {
      state.miniGoals = data.miniGoals;
    }
    if (Number.isFinite(data.activeXpMultiplier)) {
      state.activeXpMultiplier = data.activeXpMultiplier;
    }
    if (Number.isFinite(data.xpMultiplierExpiresAt)) {
      state.xpMultiplierExpiresAt = data.xpMultiplierExpiresAt;
    }
    if (Number.isFinite(data.currentStreak)) {
      state.currentStreak = data.currentStreak;
    }
    if (Number.isFinite(data.streakMultiplier)) {
      state.streakMultiplier = data.streakMultiplier;
    }
    if (data.customization && typeof data.customization === 'object') {
      state.customization = { ...state.customization, ...data.customization };
    }
    if (Array.isArray(data.friends)) {
      state.friends = data.friends;
    }
    if (Array.isArray(data.matchHistory)) {
      state.matchHistory = data.matchHistory;
    }
    recalcProgress();
  }

  function sanitizeAlias(raw) {
    if (!raw || typeof raw !== 'string') return '';
    return raw.replace(/\s+/g, ' ').trim().slice(0, 24);
  }

  function xpForLevel(level) {
    return XP_BASE + (level - 1) * XP_STEP;
  }

  function recalcProgress() {
    let remaining = state.totalXp;
    let level = 1;
    let threshold = xpForLevel(level);
    while (remaining >= threshold) {
      remaining -= threshold;
      level += 1;
      threshold = xpForLevel(level);
    }
    state.level = level;
    state.xpIntoLevel = remaining;
    state.xpToNext = threshold;
  }

  function notify() {
    listeners.forEach((listener) => listener(getSnapshot()));
  }

  function notifyAchievement(meta) {
    achievementListeners.forEach((listener) => listener(meta));
  }

  function buildPersistPayload() {
    return {
      alias: state.alias,
      totalXp: state.totalXp,
      stats: state.stats,
      achievements: state.achievements,
      rating: state.rating,
      rank: state.rank,
      dailyQuests: state.dailyQuests,
      dailyBonus: state.dailyBonus,
      weeklyChallenges: state.weeklyChallenges,
      miniGoals: state.miniGoals,
      activeXpMultiplier: state.activeXpMultiplier,
      xpMultiplierExpiresAt: state.xpMultiplierExpiresAt,
      currentStreak: state.currentStreak,
      streakMultiplier: state.streakMultiplier,
      customization: state.customization,
      friends: state.friends,
      matchHistory: state.matchHistory.slice(-50), // Последние 50 матчей
    };
  }

  function persistLocal() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistPayload()));
    } catch (error) {
      console.warn('[profile] Unable to persist to localStorage', error);
    }
  }

  function hydrateFromLocal() {
    const keys = [STORAGE_KEY, ...LEGACY_KEYS];
    for (const key of keys) {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        applyLoadedData(parsed);
        break;
      } catch (error) {
        console.warn('[profile] Failed to hydrate from localStorage', error);
      }
    }
  }

  function getSnapshot() {
    return {
      alias: state.alias,
      totalXp: state.totalXp,
      level: state.level,
      xpIntoLevel: state.xpIntoLevel,
      xpToNext: state.xpToNext,
      xpProgress: Math.min(1, state.xpIntoLevel / state.xpToNext),
      stats: { ...state.stats },
      achievements: { ...state.achievements },
      currentStreak: state.currentStreak || 0,
      streakMultiplier: state.streakMultiplier || 1.0,
      activeMultipliers: getActiveMultipliers(),
      activeMiniGoals: getActiveMiniGoals(),
    };
  }

  async function syncState() {
    persistLocal();
    await platform.save(buildPersistPayload());
  }

  async function init() {
    const platformReady = await platform.init();
    if (!platformReady) {
      hydrateFromLocal();
    }
    recalcProgress();
    if (pendingXp > 0) {
      state.totalXp += pendingXp;
      pendingXp = 0;
      recalcProgress();
      await syncState();
    }
    isReady = true;
    checkAchievements();
    // Загружаем задания с сервера в фоне
    loadQuestsFromServer().catch(() => {});
    notify();
  }

  function addListener(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function addAchievementListener(listener) {
    achievementListeners.add(listener);
    return () => achievementListeners.delete(listener);
  }

  async function addXp(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!isReady) {
      pendingXp += amount;
      return;
    }
    
    // Применяем множители XP
    let finalAmount = amount;
    
    // Множитель за серию
    if (state.streakMultiplier > 1.0) {
      finalAmount = Math.floor(finalAmount * state.streakMultiplier);
    }
    
    // Временный множитель (буст)
    if (state.activeXpMultiplier > 1.0 && state.xpMultiplierExpiresAt && Date.now() < state.xpMultiplierExpiresAt) {
      finalAmount = Math.floor(finalAmount * state.activeXpMultiplier);
    } else if (state.xpMultiplierExpiresAt && Date.now() >= state.xpMultiplierExpiresAt) {
      // Множитель истек
      state.activeXpMultiplier = 1.0;
      state.xpMultiplierExpiresAt = null;
    }
    
    state.totalXp += finalAmount;
    recalcProgress();
    await syncState();
    notify();
    
    return { base: amount, final: finalAmount, multiplier: finalAmount / amount };
  }
  
  function updateStreakMultiplier() {
    // Множитель XP за серию правильных ответов
    const streak = state.currentStreak || 0;
    if (streak >= 50) {
      state.streakMultiplier = 2.5; // x2.5 за 50+
    } else if (streak >= 30) {
      state.streakMultiplier = 2.0; // x2.0 за 30+
    } else if (streak >= 20) {
      state.streakMultiplier = 1.75; // x1.75 за 20+
    } else if (streak >= 10) {
      state.streakMultiplier = 1.5; // x1.5 за 10+
    } else if (streak >= 5) {
      state.streakMultiplier = 1.25; // x1.25 за 5+
    } else {
      state.streakMultiplier = 1.0;
    }
  }
  
  function setXpMultiplier(multiplier, durationMinutes = 30) {
    state.activeXpMultiplier = multiplier;
    state.xpMultiplierExpiresAt = Date.now() + durationMinutes * 60 * 1000;
    syncState().catch(() => {});
    notify();
  }
  
  function getActiveMultipliers() {
    const multipliers = [];
    if (state.streakMultiplier > 1.0) {
      multipliers.push({ type: 'streak', value: state.streakMultiplier, label: `Серия x${state.streakMultiplier.toFixed(2)}` });
    }
    if (state.activeXpMultiplier > 1.0 && state.xpMultiplierExpiresAt && Date.now() < state.xpMultiplierExpiresAt) {
      const minutesLeft = Math.ceil((state.xpMultiplierExpiresAt - Date.now()) / 60000);
      multipliers.push({ type: 'boost', value: state.activeXpMultiplier, label: `Буст x${state.activeXpMultiplier.toFixed(2)} (${minutesLeft}м)` });
    }
    return multipliers;
  }

  async function setAlias(newAlias) {
    const sanitized = sanitizeAlias(newAlias);
    if (!sanitized) return { success: false, error: 'Имя должно содержать хотя бы один символ' };
    if (sanitized === state.alias) return { success: true };
    
    // ВАЖНО: Проверяем доступность ника на сервере и НЕ продолжаем, если проверка не прошла
    try {
      const response = await fetch(`${API_BASE}/api/alias/check?alias=${encodeURIComponent(sanitized)}`);
      if (!response.ok) {
        return { success: false, error: 'Ошибка проверки имени. Попробуйте позже.' };
      }
      const data = await response.json();
      if (!data.available) {
        return { success: false, error: data.error || 'Имя содержит недопустимые слова или уже занято' };
      }
      // Только если проверка прошла успешно, обновляем имя
      state.alias = sanitized;
      await syncState();
      notify();
      return { success: true };
    } catch (error) {
      console.warn('[alias] Failed to check alias on server:', error);
      // НЕ продолжаем, если сервер недоступен - это критично для проверки запрещенных слов
      return { success: false, error: 'Не удалось проверить имя. Убедитесь, что сервер доступен.' };
    }
  }

  function unlockAchievement(key) {
    if (state.achievements[key]) return;
    const meta = ACHIEVEMENTS[key];
    if (!meta) return;
    state.achievements[key] = { unlockedAt: Date.now() };
    notifyAchievement({ key, ...meta });
    addXp(meta.xp);
    if (meta.ephemeral) {
      // Очищаем ephemeral флаги после разблокировки
      if (key === 'flawless') {
        state.stats.lastMatchFlawless = false;
      } else if (key === 'comeback') {
        state.stats.lastMatchComeback = false;
      } else if (key === 'speedDemon') {
        state.stats.lastMatchSpeedDemon = false;
      }
    }
    syncState().catch(() => {});
    notify();
  }

  function checkAchievements() {
    const stats = { ...state.stats, level: state.level };
    Object.entries(ACHIEVEMENTS).forEach(([key, meta]) => {
      if (state.achievements[key]) return;
      try {
        if (meta.condition(stats)) {
          unlockAchievement(key);
        }
      } catch (error) {
        console.warn('[profile] Achievement check failed', key, error);
      }
    });
  }

  function recordSingleAnswer({ correct }) {
    if (correct) {
      state.stats.singleCorrect += 1;
      state.stats.totalCorrect += 1;
      state.stats.totalAnswers += 1;
      // Обновляем текущую серию
      state.currentStreak = (state.currentStreak || 0) + 1;
      updateStreakMultiplier();
      updateDailyQuests('correct', 1);
      checkMiniGoals('correct');
      // Обновляем bestStreak через singleState.score, который отслеживается в answerSingle
      checkAchievements();
      syncState().catch(() => {});
      notify();
    } else {
      state.stats.totalAnswers += 1;
      // Сбрасываем серию при ошибке
      state.currentStreak = 0;
      state.streakMultiplier = 1.0;
      syncState().catch(() => {});
      notify();
    }
  }

  function recordDuelResult({ won, correct, wrong, opponentRating, wasFlawless, wasComeback, wasSpeedDemon, myScore, oppScore }) {
    state.stats.duelMatches += 1;
    state.stats.duelCorrect += Number(correct || 0);
    state.stats.duelWrong += Number(wrong || 0);
    state.stats.totalCorrect += Number(correct || 0);
    state.stats.totalAnswers += Number(correct || 0) + Number(wrong || 0);
    
    // Отслеживание идеальных побед
    const isFlawless = Boolean(won && !wrong);
    state.stats.lastMatchFlawless = isFlawless;
    if (isFlawless) {
      state.stats.flawlessWins = (state.stats.flawlessWins || 0) + 1;
    }
    
    // Отслеживание возвращений (победа при отставании 0:5)
    state.stats.lastMatchComeback = Boolean(wasComeback || (won && myScore !== undefined && oppScore !== undefined && oppScore >= 5 && myScore === 0));
    
    // Отслеживание скоростных ответов
    state.stats.lastMatchSpeedDemon = Boolean(wasSpeedDemon);
    
    updateDailyQuests('correct', Number(correct || 0));
    updateDailyQuests('matches', 1);
    updateWeeklyChallenges('correct', Number(correct || 0));
    
    if (won) {
      state.stats.duelWins += 1;
      
      // Отслеживание ежедневных побед
      const today = getTodayKey();
      if (!state.stats.dailyWins) state.stats.dailyWins = {};
      if (state.stats.dailyWins.date !== today) {
        state.stats.dailyWins = { date: today, count: 0 };
      }
      state.stats.dailyWins.count = (state.stats.dailyWins.count || 0) + 1;
      
      // Отслеживание серии побед
      state.stats.currentWinStreak = (state.stats.currentWinStreak || 0) + 1;
      
      updateDailyQuests('wins', 1);
      updateWeeklyChallenges('wins', 1);
      // Обновляем серию при победе
      state.currentStreak = (state.currentStreak || 0) + 1;
      updateStreakMultiplier();
      addXp(XP_DUEL_WIN);
      updateRating(true, opponentRating || 1000);
    } else {
      state.stats.duelLosses += 1;
      // Сбрасываем серию при поражении
      state.currentStreak = 0;
      state.streakMultiplier = 1.0;
      state.stats.currentWinStreak = 0;
      updateRating(false, opponentRating || 1000);
    }
    
    // Сохраняем историю матча
    state.matchHistory.push({
      timestamp: Date.now(),
      won,
      correct: Number(correct || 0),
      wrong: Number(wrong || 0),
      opponentRating: opponentRating || 1000,
    });
    
    checkAchievements();
    syncState().catch(() => {});
    notify();
  }

  function getAchievementsList(category = 'all') {
    return Object.entries(ACHIEVEMENTS)
      .filter(([key, meta]) => category === 'all' || meta.category === category)
      .map(([key, meta]) => ({
        id: key,
        title: meta.title,
        description: meta.description,
        xp: meta.xp,
        category: meta.category || 'special',
        level: meta.level || 1,
        rare: meta.rare || false,
        unlocked: Boolean(state.achievements[key]),
        unlockedAt: state.achievements[key]?.unlockedAt ?? null,
      }))
      .sort((a, b) => {
        // Сначала разблокированные, потом по категории, потом по уровню
        if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.level - b.level;
      });
  }

  function updateBestStreak(newStreak) {
    if (newStreak > (state.stats.bestStreak || 0)) {
      state.stats.bestStreak = newStreak;
      checkAchievements();
      syncState().catch(() => {});
      notify();
    }
  }

  // Ежедневные задания (fallback, если сервер недоступен)
  const DEFAULT_DAILY_QUESTS = [
    { id: 'correct20', title: '20 правильных ответов', description: 'Дай 20 правильных ответов', target: 20, type: 'correct', xp: 30 },
    { id: 'win3', title: '3 победы', description: 'Выиграй 3 дуэли', target: 3, type: 'wins', xp: 50 },
    { id: 'streak15', title: 'Серия 15', description: 'Достигни серии из 15 правильных ответов', target: 15, type: 'streak', xp: 40 },
    { id: 'play10', title: '10 игр', description: 'Сыграй 10 матчей (одиночных или дуэлей)', target: 10, type: 'matches', xp: 25 },
  ];
  
  const DEFAULT_WEEKLY_CHALLENGES = [
    { id: 'week_correct100', title: '100 правильных за неделю', description: 'Дай 100 правильных ответов за неделю', target: 100, type: 'correct', xp: 200, reward: 'x1.5 XP на 1 час' },
    { id: 'week_wins10', title: '10 побед за неделю', description: 'Выиграй 10 дуэлей за неделю', target: 10, type: 'wins', xp: 300, reward: 'x2.0 XP на 30 минут' },
    { id: 'week_streak30', title: 'Серия 30 за неделю', description: 'Достигни серии из 30 правильных ответов', target: 30, type: 'streak', xp: 250, reward: 'x1.75 XP на 45 минут' },
  ];
  
  const DEFAULT_MINI_GOALS = [
    { id: 'mini_5in2min', title: '5 за 2 минуты', description: 'Дай 5 правильных ответов за 2 минуты', target: 5, type: 'correct', timeLimit: 120000, xp: 20 },
    { id: 'mini_10in5min', title: '10 за 5 минут', description: 'Дай 10 правильных ответов за 5 минут', target: 10, type: 'correct', timeLimit: 300000, xp: 50 },
  ];
  
  // Загруженные задания с сервера
  let DAILY_QUESTS = [...DEFAULT_DAILY_QUESTS];
  let WEEKLY_CHALLENGES = [...DEFAULT_WEEKLY_CHALLENGES];
  let MINI_GOALS = [...DEFAULT_MINI_GOALS];
  let questsVersion = 0;
  let questsLastFetched = 0;
  const QUESTS_CACHE_MS = 5 * 60 * 1000; // Кэш на 5 минут
  
  // Загрузка заданий с сервера
  async function loadQuestsFromServer() {
    const now = Date.now();
    // Проверяем кэш
    if (questsLastFetched > 0 && (now - questsLastFetched) < QUESTS_CACHE_MS) {
      return; // Используем кэш
    }
    
    try {
      const response = await fetch(`${API_BASE}/api/quests`);
      if (!response.ok) {
        console.warn(`[quests] Failed to fetch from server (${response.status}), using defaults`);
        return;
      }
      const data = await response.json();
      
      // Проверяем версию
      if (data.version && data.version > questsVersion) {
        questsVersion = data.version;
        if (data.dailyQuests && Array.isArray(data.dailyQuests)) {
          DAILY_QUESTS = data.dailyQuests;
        }
        if (data.weeklyChallenges && Array.isArray(data.weeklyChallenges)) {
          WEEKLY_CHALLENGES = data.weeklyChallenges;
        }
        if (data.miniGoals && Array.isArray(data.miniGoals)) {
          MINI_GOALS = data.miniGoals;
        }
        questsLastFetched = now;
        console.log('[quests] Loaded from server, version:', data.version);
        notify(); // Уведомляем об обновлении
      }
    } catch (error) {
      console.warn('[quests] Error loading from server:', error);
      // Используем значения по умолчанию
    }
  }

  function getTodayKey() {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  }

  function initDailyQuests() {
    const today = getTodayKey();
    if (!state.dailyQuests[today]) {
      state.dailyQuests = {};
      state.dailyQuests[today] = DAILY_QUESTS.map((q) => ({
        ...q,
        progress: 0,
        completed: false,
      }));
    }
  }

  function updateDailyQuests(type, amount = 1) {
    const today = getTodayKey();
    initDailyQuests();
    if (!state.dailyQuests[today]) return;

    let anyCompleted = false;
    state.dailyQuests[today].forEach((quest) => {
      if (quest.completed || quest.type !== type) return;
      quest.progress = Math.min(quest.progress + amount, quest.target);
      if (quest.progress >= quest.target && !quest.completed) {
        quest.completed = true;
        addXp(quest.xp);
        anyCompleted = true;
      }
    });

    if (anyCompleted) {
      syncState().catch(() => {});
      notify();
    }
  }

  function getDailyQuests() {
    initDailyQuests();
    const today = getTodayKey();
    return state.dailyQuests[today] || [];
  }
  
  function getWeekKey() {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    return startOfWeek.toISOString().split('T')[0];
  }
  
  function initWeeklyChallenges() {
    const week = getWeekKey();
    if (!state.weeklyChallenges[week]) {
      state.weeklyChallenges = {};
      state.weeklyChallenges[week] = WEEKLY_CHALLENGES.map((challenge) => ({
        ...challenge,
        progress: 0,
        completed: false,
        claimed: false,
      }));
    }
  }
  
  function updateWeeklyChallenges(type, amount = 1) {
    const week = getWeekKey();
    initWeeklyChallenges();
    
    if (!state.weeklyChallenges[week]) return;
    
    let anyCompleted = false;
    state.weeklyChallenges[week].forEach((challenge) => {
      if (challenge.completed || challenge.type !== type) return;
      challenge.progress = Math.min(challenge.progress + amount, challenge.target);
      if (challenge.progress >= challenge.target && !challenge.completed) {
        challenge.completed = true;
        anyCompleted = true;
      }
    });
    
    if (anyCompleted) {
      syncState().catch(() => {});
      notify();
    }
  }
  
  function claimWeeklyReward(challengeId) {
    const week = getWeekKey();
    if (!state.weeklyChallenges[week]) return null;
    
    const challenge = state.weeklyChallenges[week].find(c => c.id === challengeId);
    if (!challenge || !challenge.completed || challenge.claimed) return null;
    
    challenge.claimed = true;
    addXp(challenge.xp);
    
    // Применяем награду (множитель XP)
    if (challenge.reward) {
      const match = challenge.reward.match(/x([\d.]+).*?(\d+)\s*(ч|м|мин)/);
      if (match) {
        const multiplier = parseFloat(match[1]);
        const duration = parseInt(match[2]);
        const unit = match[3];
        const minutes = unit === 'ч' ? duration * 60 : duration;
        setXpMultiplier(multiplier, minutes);
      }
    }
    
    syncState().catch(() => {});
    notify();
    return challenge;
  }
  
  function getWeeklyChallenges() {
    const week = getWeekKey();
    initWeeklyChallenges();
    return state.weeklyChallenges[week] || [];
  }
  
  function startMiniGoal(goalId) {
    const goal = MINI_GOALS.find(g => g.id === goalId);
    if (!goal) {
      console.warn('[miniGoals] Goal not found:', goalId);
      return null;
    }
    
    // Проверяем, не активна ли уже эта цель
    const existing = state.miniGoals.find(g => g.id === goalId && g.active && !g.completed);
    if (existing) {
      console.log('[miniGoals] Goal already active:', goalId);
      return existing;
    }
    
    // Удаляем старые неактивные или завершенные цели с тем же ID
    state.miniGoals = state.miniGoals.filter(g => !(g.id === goalId && (g.completed || !g.active)));
    
    const activeGoal = {
      ...goal,
      startTime: Date.now(),
      progress: 0,
      completed: false,
      active: true,
    };
    
    state.miniGoals.push(activeGoal);
    syncState().catch(() => {});
    notify();
    return activeGoal;
  }
  
  function checkMiniGoals(type) {
    const now = Date.now();
    let hasChanges = false;
    
    state.miniGoals = state.miniGoals.map(goal => {
      // Пропускаем уже завершенные цели
      if (goal.completed) return goal;
      
      // Пропускаем неактивные цели
      if (!goal.active) return goal;
      
      // Пропускаем цели другого типа
      if (goal.type !== type) return goal;
      
      // Проверяем, не истекло ли время
      const elapsed = now - goal.startTime;
      if (elapsed > goal.timeLimit) {
        goal.active = false;
        hasChanges = true;
        return goal;
      }
      
      // Увеличиваем прогресс только если цель активна и время не истекло
      const newProgress = (goal.progress || 0) + 1;
      goal.progress = newProgress;
      hasChanges = true;
      
      // Проверяем, достигнута ли цель
      if (newProgress >= goal.target) {
        goal.completed = true;
        goal.active = false;
        addXp(goal.xp);
        // Показываем уведомление о завершении
        if (typeof showAchievementToast === 'function') {
          showAchievementToast({ 
            title: 'Мини-цель выполнена!', 
            description: goal.description, 
            xp: goal.xp 
          });
        }
      }
      
      return goal;
    });
    
    if (hasChanges) {
      syncState().catch(() => {});
      notify();
    }
  }
  
  function getActiveMiniGoals() {
    const now = Date.now();
    return state.miniGoals.filter(goal => {
      // Пропускаем завершенные цели
      if (goal.completed) return false;
      
      // Пропускаем неактивные цели
      if (!goal.active) return false;
      
      // Проверяем, не истекло ли время
      const elapsed = now - (goal.startTime || 0);
      if (elapsed > goal.timeLimit) {
        // Автоматически деактивируем истекшие цели
        goal.active = false;
        return false;
      }
      
      return true;
    });
  }
  
  function getAvailableMiniGoals() {
    return MINI_GOALS.filter(goal => {
      const active = state.miniGoals.find(g => g.id === goal.id && g.active && !g.completed);
      return !active;
    });
  }

  function claimDailyBonus() {
    const today = getTodayKey();
    const lastClaim = state.dailyBonus.lastClaim;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

    if (lastClaim === today) return false; // Уже забрали сегодня

    let streak = state.dailyBonus.streak || 0;
    if (lastClaim === yesterdayKey) {
      streak += 1;
    } else if (lastClaim !== today) {
      streak = 1; // Сброс серии
    }

    state.dailyBonus.lastClaim = today;
    state.dailyBonus.streak = streak;
    const bonusXp = 50 + streak * 10; // 50 + 10 за каждый день серии
    addXp(bonusXp);
    syncState().catch(() => {});
    notify();
    return { xp: bonusXp, streak };
  }

  function canClaimDailyBonus() {
    const today = getTodayKey();
    return state.dailyBonus.lastClaim !== today;
  }

  // Рейтинговая система
  function calculateRank(rating) {
    if (rating < 1200) return 'Новичок';
    if (rating < 1400) return 'Опытный';
    if (rating < 1600) return 'Продвинутый';
    if (rating < 1800) return 'Эксперт';
    if (rating < 2000) return 'Мастер';
    return 'Легенда';
  }

  function updateRating(won, opponentRating = 1000) {
    const K = 32; // Коэффициент K для ELO
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - state.rating) / 400));
    const actualScore = won ? 1 : 0;
    const change = Math.round(K * (actualScore - expectedScore));
    state.rating = Math.max(0, state.rating + change);
    state.rank = calculateRank(state.rating);
    syncState().catch(() => {});
    notify();
    return change;
  }

  function getRating() {
    return { rating: state.rating, rank: state.rank };
  }


  return {
    init,
    addListener,
    addAchievementListener,
    getSnapshot,
    addXp,
    setAlias,
    recordSingleAnswer,
    recordDuelResult,
    getAchievementsList,
    updateBestStreak,
    checkAchievements,
    ACHIEVEMENT_CATEGORIES,
    // Ежедневные задания
    getDailyQuests,
    updateDailyQuests,
    claimDailyBonus,
    canClaimDailyBonus,
    // Еженедельные вызовы
    getWeeklyChallenges,
    updateWeeklyChallenges,
    claimWeeklyReward,
    // Мини-цели
    getAvailableMiniGoals,
    startMiniGoal,
    getActiveMiniGoals,
    checkMiniGoals,
    // Загрузка заданий
    loadQuestsFromServer,
    // Множители XP
    setXpMultiplier,
    getActiveMultipliers,
    updateStreakMultiplier,
    // Рейтинг
    updateRating,
    getRating,
    // Другое
    XP_SINGLE_CORRECT,
    XP_DUEL_CORRECT,
    XP_DUEL_WIN,
  };
})();

// Обработчики для sidebar профиля (объявляем ДО использования)
const profileToggleBtn = document.getElementById('profile-toggle');
const profileSidebar = document.getElementById('profile-sidebar');
const profileOverlay = document.getElementById('profile-overlay');
const profileCloseBtn = document.getElementById('profile-close');
const profileNameCompact = document.getElementById('profile-name-compact');
const profileLevelCompact = document.getElementById('profile-level-compact');

profileManager.addListener(renderProfile);
renderProfile(profileManager.getSnapshot());
profileManager.addAchievementListener(showAchievementToast);

function openProfileSidebar() {
  if (profileSidebar) profileSidebar.classList.add('open');
  if (profileOverlay) profileOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeProfileSidebar() {
  if (profileSidebar) profileSidebar.classList.remove('open');
  if (profileOverlay) profileOverlay.classList.add('hidden');
  document.body.style.overflow = '';
}

profileToggleBtn?.addEventListener('click', openProfileSidebar);
profileCloseBtn?.addEventListener('click', closeProfileSidebar);
profileOverlay?.addEventListener('click', closeProfileSidebar);

// Закрытие по Escape
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && profileSidebar?.classList.contains('open')) {
    closeProfileSidebar();
  }
});

function renderProfile(snapshot) {
  if (!snapshot) return;
  if (profileNameEl) profileNameEl.textContent = snapshot.alias;
  if (profileLevelEl) profileLevelEl.textContent = `Уровень ${snapshot.level}`;
  const xpToNext = snapshot.xpToNext || 1;
  if (profileXpTextEl) profileXpTextEl.textContent = `${snapshot.xpIntoLevel} / ${xpToNext} XP`;
  if (profileXpBarEl) profileXpBarEl.style.width = `${Math.min(100, Math.round(snapshot.xpProgress * 100))}%`;
  
  // Отображаем активные множители XP
  const multipliersEl = document.getElementById('profile-multipliers');
  if (multipliersEl) {
    const multipliers = snapshot.activeMultipliers || [];
    if (multipliers.length > 0) {
      multipliersEl.innerHTML = multipliers.map(m => 
        `<span class="multiplier-badge ${m.type}">${m.label}</span>`
      ).join('');
      multipliersEl.style.display = 'flex';
    } else {
      multipliersEl.innerHTML = '';
      multipliersEl.style.display = 'none';
    }
  }
  
  // Отображаем текущую серию
  const streakEl = document.getElementById('profile-streak');
  if (streakEl && snapshot.currentStreak > 0) {
    streakEl.innerHTML = `<span class="streak-badge">🔥 Серия: ${snapshot.currentStreak}</span>`;
    streakEl.style.display = 'block';
  } else if (streakEl) {
    streakEl.innerHTML = '';
    streakEl.style.display = 'none';
  }
  
  // Обновляем компактное отображение в header
  if (profileNameCompact) profileNameCompact.textContent = snapshot.alias;
  if (profileLevelCompact) profileLevelCompact.textContent = `Lv.${snapshot.level}`;
  
  if (mpPlayerSelfEl) {
    mpPlayerSelfEl.textContent = `Вы (${snapshot.alias})`;
  }
  mpState.alias = snapshot.alias;
  if (typeof syncAliasToServer === 'function') {
    syncAliasToServer();
  }
  updateAchievementsSummary();
}

// Элементы для модального окна изменения имени
const aliasBackdrop = document.getElementById('alias-backdrop');
const aliasModal = document.getElementById('alias-modal');
const aliasInput = document.getElementById('alias-input');
const aliasError = document.getElementById('alias-error');
const aliasSaveBtn = document.getElementById('alias-save');
const aliasCancelBtn = document.getElementById('alias-cancel');
const aliasCloseBtn = document.getElementById('alias-close');

// Элементы для модального окна уведомлений
const alertBackdrop = document.getElementById('alert-backdrop');
const alertModal = document.getElementById('alert-modal');
const alertMessage = document.getElementById('alert-message');
const alertOkBtn = document.getElementById('alert-ok');
const alertCloseBtn = document.getElementById('alert-close');

function showAlert(message) {
  if (!alertModal || !alertBackdrop || !alertMessage) {
    // Fallback для случаев, когда элементы не найдены
    console.warn('[alert] Modal elements not found, message:', message);
    return;
  }
  alertMessage.textContent = message;
  alertBackdrop.classList.remove('hidden');
  alertModal.classList.remove('hidden');
}

function closeAlert() {
  if (!alertModal || !alertBackdrop) return;
  alertBackdrop.classList.add('hidden');
  alertModal.classList.add('hidden');
}

function openAliasModal() {
  if (!aliasModal || !aliasBackdrop || !aliasInput) return;
  const current = profileManager.getSnapshot().alias;
  aliasInput.value = current;
  aliasError.classList.add('hidden');
  aliasError.textContent = '';
  aliasBackdrop.classList.remove('hidden');
  aliasModal.classList.remove('hidden');
  aliasInput.focus();
  aliasInput.select();
}

function closeAliasModal() {
  if (!aliasModal || !aliasBackdrop) return;
  aliasBackdrop.classList.add('hidden');
  aliasModal.classList.add('hidden');
  aliasInput.value = '';
  aliasError.classList.add('hidden');
  aliasError.textContent = '';
}

async function promptAliasChange() {
  openAliasModal();
}

// Обработчики для модального окна изменения имени
aliasSaveBtn?.addEventListener('click', async () => {
  const newAlias = aliasInput?.value?.trim();
  if (!newAlias) {
    aliasError.textContent = 'Имя не может быть пустым';
    aliasError.classList.remove('hidden');
    return;
  }
  
  const result = await profileManager.setAlias(newAlias);
  if (result.success) {
    closeAliasModal();
  } else {
    aliasError.textContent = result.error || 'Не удалось изменить имя. Попробуйте другое.';
    aliasError.classList.remove('hidden');
  }
});

aliasCancelBtn?.addEventListener('click', closeAliasModal);
aliasCloseBtn?.addEventListener('click', closeAliasModal);
aliasBackdrop?.addEventListener('click', closeAliasModal);

// Обработчики для модального окна уведомлений
alertOkBtn?.addEventListener('click', closeAlert);
alertCloseBtn?.addEventListener('click', closeAlert);
alertBackdrop?.addEventListener('click', closeAlert);

// Закрытие по Enter в поле ввода имени
aliasInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    aliasSaveBtn?.click();
  } else if (e.key === 'Escape') {
    closeAliasModal();
  }
});

// Закрытие уведомлений по Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!alertModal?.classList.contains('hidden')) {
      closeAlert();
    }
    if (!aliasModal?.classList.contains('hidden')) {
      closeAliasModal();
    }
    if (!aboutModal?.classList.contains('hidden')) {
      closeAboutModal();
    }
  }
});

profileEditBtn?.addEventListener('click', promptAliasChange);
profileAchievementsBtn?.addEventListener('click', openAchievementsModal);
achievementsCloseBtn?.addEventListener('click', closeAchievementsModal);
achievementsBackdrop?.addEventListener('click', closeAchievementsModal);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeAchievementsModal();
  }
});

// Обработчики для вкладок категорий достижений
document.querySelectorAll('.achievement-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    // Убираем активный класс у всех вкладок
    document.querySelectorAll('.achievement-tab').forEach(t => t.classList.remove('active'));
    // Добавляем активный класс к выбранной
    tab.classList.add('active');
    // Обновляем текущую категорию и перерисовываем список
    currentAchievementCategory = tab.dataset.category;
    const achievements = getAchievementsData(currentAchievementCategory);
    renderAchievementsList(achievements, currentAchievementCategory);
  });
});

async function preloadSingleQuestions(count = 5) {
  try {
    const response = await fetch(`${API_BASE}/api/questions/batch?count=${count}`);
    if (!response.ok) return;
    const data = await response.json();
    singleState.preloadedQuestions.push(...data.questions);
    
    // Предзагружаем изображения в фоне
    data.questions.forEach(question => {
      preloadImage(question.imageUrl, singleState.preloadedImages).catch(() => {
        // Игнорируем ошибки предзагрузки
      });
    });
  } catch (error) {
    // Игнорируем ошибки предзагрузки
  }
}

async function loadSingleQuestion(nextQuestion) {
  try {
    if (singleState.nextQuestionTimer) {
      window.clearTimeout(singleState.nextQuestionTimer);
      singleState.nextQuestionTimer = null;
    }
    if (singleFrameEl) setFrameHighlight(singleFrameEl, null);
    if (singleResultChipEl) showResultChip(singleResultChipEl, null);
    if (singleStatusEl) updateInlineStatus(singleStatusEl, null, '');
    let question = nextQuestion;
    
    // Используем предзагруженный вопрос, если есть
    if (!question && singleState.preloadedQuestions.length > 0) {
      question = singleState.preloadedQuestions.shift();
      // Дозагружаем новые вопросы, если осталось мало
      if (singleState.preloadedQuestions.length < 3) {
        preloadSingleQuestions(5).catch(() => {});
      }
    }
    
    if (!question) {
      const resp = await fetch(`${API_BASE}/api/questions/single`);
      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`Не удалось получить задание: ${resp.status} ${errorText}`);
      }
      const data = await resp.json();
      question = data.question;
    }
    if (!question || !question.imageUrl) {
      throw new Error('Неверный формат вопроса от сервера');
    }
    singleState.question = question;
    if (singleImageEl && singleFrameEl) {
      beginImageLoad(singleImageEl, singleFrameEl, question.imageUrl, null, singleState.preloadedImages);
      singleImageEl.alt = 'Изображение для проверки';
    }
    
    // Дозагружаем вопросы в фоне после загрузки текущего
    if (singleState.preloadedQuestions.length < 3) {
      preloadSingleQuestions(5).catch(() => {});
    }
    if (singleFeedbackEl) {
      singleFeedbackEl.textContent = '';
      singleFeedbackEl.classList.remove('success', 'error');
    }
    if (singleSourceEl) {
      singleSourceEl.textContent = '';
    }
  } catch (error) {
    console.error('[loadSingleQuestion] Error:', error);
    if (singleFeedbackEl) {
      singleFeedbackEl.textContent = 'Ошибка загрузки изображения. Попробуйте ещё раз.';
      singleFeedbackEl.classList.add('error');
    }
  }
}

async function answerSingle(event) {
  if (singleState.isBusy || !singleState.question) return;
  const answer = event.currentTarget.dataset.answer;
  singleState.isBusy = true;
  try {
    const resp = await fetch(`${API_BASE}/api/questions/single/${singleState.question.questionId}/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ answer }),
    });
    if (!resp.ok) {
      throw new Error('Сервер не принял ответ');
    }
    const data = await resp.json();
    if (data.correct) {
      singleState.score += 1;
      singleFeedbackEl.textContent = 'Верно!';
      singleFeedbackEl.classList.remove('error');
      singleFeedbackEl.classList.add('success');
      setFrameHighlight(singleFrameEl, 'success');
      showResultChip(singleResultChipEl, 'success', 'Правильно!');
      updateInlineStatus(singleStatusEl, 'success', 'Правильно');
      profileManager.addXp(profileManager.XP_SINGLE_CORRECT);
      profileManager.recordSingleAnswer({ correct: true });
      if (singleState.score > singleState.best) {
        singleState.best = singleState.score;
        window.localStorage.setItem('single-best-score', singleState.best);
      }
      // Обновляем bestStreak в профиле
      profileManager.updateBestStreak(singleState.score);
      // Обновляем задание на серию
      if (singleState.score >= 15) {
        profileManager.updateDailyQuests('streak', singleState.score);
        profileManager.updateWeeklyChallenges('streak', singleState.score);
      }
      // Проверяем мини-цели
      profileManager.checkMiniGoals('correct');
    } else {
      singleState.score = 0;
      singleFeedbackEl.textContent =
        data.correctAnswer === 'real' ? 'Это было реальное фото.' : 'Это изображение создала нейросеть.';
      singleFeedbackEl.classList.remove('success');
      singleFeedbackEl.classList.add('error');
      setFrameHighlight(singleFrameEl, 'error');
      showResultChip(singleResultChipEl, 'error', 'Неверно');
      updateInlineStatus(singleStatusEl, 'error', 'Неверно');
    }
    singleScoreEl.textContent = singleState.score;
    singleBestEl.textContent = singleState.best;
    // Используем предзагруженный вопрос, если есть
    const nextQ = data.nextQuestion || (singleState.preloadedQuestions.length > 0 ? singleState.preloadedQuestions.shift() : null);
    if (nextQ) {
      singleState.nextQuestionTimer = window.setTimeout(() => {
        loadSingleQuestion(nextQ);
      }, 850);
    } else {
      singleState.question = null;
    }
  } catch (error) {
    console.error(error);
    singleFeedbackEl.textContent = 'Не удалось отправить ответ.';
    singleFeedbackEl.classList.remove('success');
    singleFeedbackEl.classList.add('error');
    setFrameHighlight(singleFrameEl, 'error');
    showResultChip(singleResultChipEl, 'error', 'Ошибка');
    updateInlineStatus(singleStatusEl, 'error', 'Ошибка');
  } finally {
    singleState.isBusy = false;
  }
}

document.querySelectorAll('#single-player .choice-button').forEach((button) => {
  button.addEventListener('click', answerSingle);
});

// Объявляем переменные ДО использования
let aliasSyncTimeout = null;

// Инициализация после загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
  });
} else {
  initializeApp();
}

function initializeApp() {
  profileManager.init().then(() => {
    // Предзагружаем вопросы для одиночной игры
    preloadSingleQuestions(5).then(() => {
      loadSingleQuestion();
    }).catch(() => {
      loadSingleQuestion();
    });
    updateAchievementsSummary();
  }).catch((error) => {
    console.error('[init] Error:', error);
    loadSingleQuestion();
    updateAchievementsSummary();
  });
}

function syncAliasToServer() {
  if (!mpState.socket || mpState.socket.readyState !== WebSocket.OPEN) return;
  if (aliasSyncTimeout) {
    window.clearTimeout(aliasSyncTimeout);
  }
  aliasSyncTimeout = window.setTimeout(() => {
    const snapshot = profileManager.getSnapshot();
    mpState.socket.send(JSON.stringify({ type: 'set-alias', payload: { alias: snapshot.alias } }));
  }, 100);
}

profileManager
  .init()
  .catch((error) => {
    console.error('[profile] initialization failed', error);
  });

function setMpStatus(text) {
  mpStatusEl.textContent = text;
}

function updateMpScores() {
  const selfScore = mpState.scoreById[mpState.playerId] ?? 0;
  const opponentScore = mpState.opponentId ? mpState.scoreById[mpState.opponentId] ?? 0 : 0;
  mpScoreSelfEl.textContent = selfScore;
  mpScoreOpponentEl.textContent = opponentScore;
}

function stopMpTimer() {
  if (mpState.timerInterval) {
    clearInterval(mpState.timerInterval);
    mpState.timerInterval = null;
  }
  mpState.questionDeadline = null;
  if (mpTimerEl) {
    mpTimerEl.classList.add('hidden');
    mpTimerEl.classList.remove('low');
  }
}

function refreshMpTimerDisplay() {
  if (!mpTimerEl || !mpState.questionDeadline) return;
  const remaining = Math.max(0, mpState.questionDeadline - Date.now());
  const seconds = (remaining / 1000).toFixed(1);
  mpTimerEl.textContent = `${seconds} c`;
  if (remaining <= 1500) {
    mpTimerEl.classList.add('low');
  } else {
    mpTimerEl.classList.remove('low');
  }
  if (remaining <= 0) {
    stopMpTimer();
  }
}

function startMpTimer(deadline) {
  if (!mpTimerEl) return;
  mpState.questionDeadline = deadline;
  mpTimerEl.style.display = 'block';
  mpTimerEl.classList.remove('hidden');
  refreshMpTimerDisplay();
  if (mpState.timerInterval) {
    clearInterval(mpState.timerInterval);
  }
  mpState.timerInterval = setInterval(refreshMpTimerDisplay, 100);
}

function connectSocket() {
  if (mpState.socket && mpState.socket.readyState !== WebSocket.CLOSED) {
    console.log('[connectSocket] Socket already exists, state:', mpState.socket.readyState);
    return;
  }
  console.log('[connectSocket] Connecting to', `${WS_BASE}/ws`);
  try {
    const socket = new WebSocket(`${WS_BASE}/ws`);
    mpState.socket = socket;

    socket.addEventListener('open', () => {
      console.log('[connectSocket] WebSocket connected');
      setMpStatus('Готово к игре. Нажмите «В бой».');
      if (mpQueueBtn) mpQueueBtn.disabled = false;
    });

    socket.addEventListener('error', (error) => {
      console.error('[connectSocket] WebSocket error:', error);
      setMpStatus('Ошибка подключения. Проверьте, что сервер запущен.');
      if (mpQueueBtn) mpQueueBtn.disabled = true;
    });

    socket.addEventListener('close', () => {
      console.log('[connectSocket] WebSocket closed');
      setMpStatus('Соединение потеряно. Переподключаюсь...');
      if (mpQueueBtn) mpQueueBtn.disabled = true;
      if (mpMatchInfoEl) mpMatchInfoEl.classList.add('hidden');
      mpState.socket = null;
      mpState.matchId = null;
      mpState.queued = false;
      mpState.currentQuestion = null;
      if (mpFrameEl) setFrameHighlight(mpFrameEl, null);
      setTimeout(connectSocket, 1500);
    });

  socket.addEventListener('message', (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      console.error('Invalid WS payload', error);
      return;
    }
    const { type, payload } = message;
    switch (type) {
      case 'connected':
        mpState.playerId = payload.playerId;
        mpState.alias = profileManager.getSnapshot().alias;
        mpPlayerSelfEl.textContent = `Вы (${mpState.alias})`;
        syncAliasToServer();
        break;

      case 'queued':
        setMpStatus(payload.message ?? 'Ожидание соперника...');
        mpQueueBtn.textContent = 'Отменить поиск';
        mpState.queued = true;
        // Начинаем предзагрузку изображений пока ищем соперника
        // Начинаем предзагрузку сразу при входе в очередь
        if (mpState.preloadedQuestions.length === 0) {
          preloadQuestions(40).catch(err => console.warn('[preload] Queue preload failed:', err));
        } else if (mpState.preloadedQuestions.length < 30) {
          // Дозагружаем, если мало осталось
          preloadQuestions(30).catch(() => {});
        }
        break;

      case 'queue-left':
        setMpStatus('Поиск отменён. Нажмите «В бой», чтобы вернуться.');
        mpQueueBtn.textContent = 'В бой';
        mpState.queued = false;
        break;

      case 'match-start': {
        const players = payload.players;
        mpState.matchId = payload.matchId;
        mpState.targetScore = payload.targetScore;
        if (mpTargetEl) {
          mpTargetEl.textContent = `До победы: ${payload.targetScore} правильных ответов`;
        }
        stopMpTimer();
        const opponent = players.find((p) => p.id !== mpState.playerId);
        mpState.opponentId = opponent?.id ?? null;
        mpState.opponentAlias = opponent?.alias ?? 'Соперник';
        mpPlayerOpponentEl.textContent = mpState.opponentAlias;
        mpPlayerSelfEl.textContent = `Вы (${profileManager.getSnapshot().alias})`;
        mpState.scoreById = {
          [mpState.playerId]: 0,
        };
        if (mpState.opponentId) {
          mpState.scoreById[mpState.opponentId] = 0;
        }
        updateMpScores();
        setAnswerButtonsDisabled(false);
        mpState.answeredThisRound = false;
        mpState.statsSnapshot = null;
        mpMatchInfoEl.classList.remove('hidden');
        mpStatusEl.textContent = 'Загрузка изображений...';
        mpQueueBtn.textContent = 'Выйти';
        mpState.queued = false;
        mpFeedbackEl.textContent = '';
        mpFeedbackEl.classList.remove('success', 'error');
        setFrameHighlight(mpFrameEl, null);
        showResultChip(mpResultChipEl, null);
        
        // Предзагружаем вопросы и изображения ДО начала игры
        mpState.preloadedQuestions = [];
        mpState.preloadedImages.clear();
        mpStatusEl.textContent = 'Загрузка изображений...';
        
        // Загружаем 50 изображений для более плавной игры
        preloadQuestions(50).then(() => {
          mpStatusEl.textContent = 'Готово! Ожидание первого вопроса...';
          // Отправляем серверу сигнал о готовности
          if (mpState.socket && mpState.socket.readyState === WebSocket.OPEN && mpState.matchId) {
            mpState.socket.send(JSON.stringify({
              type: 'client-ready',
              payload: { matchId: mpState.matchId },
            }));
          }
          // Дополнительно предзагружаем еще 30 изображений в фоне
          preloadQuestions(30).catch(() => {});
        }).catch(err => {
          console.error('[preload] Failed to preload:', err);
          mpStatusEl.textContent = 'Ошибка загрузки. Игра начнется...';
        });
        break;
      }

      case 'question':
        mpState.currentQuestion = payload.question;
        mpState.answeredThisRound = false;
        mpState.pendingDeadline = null;
        mpState.imageLoaded = false;
        mpFeedbackEl.textContent = '';
        mpFeedbackEl.classList.remove('success', 'error');
        setFrameHighlight(mpFrameEl, null);
        showResultChip(mpResultChipEl, null);
        setAnswerButtonsDisabled(false);
        stopMpTimer();
        
        // Удаляем использованный вопрос из предзагруженных
        const questionIndex = mpState.preloadedQuestions.findIndex(q => q.questionId === payload.question.questionId);
        if (questionIndex !== -1) {
          mpState.preloadedQuestions.splice(questionIndex, 1);
        }
        
        // Подгружаем новые вопросы в фоне, если осталось мало (более агрессивная дозагрузка)
        if (mpState.preloadedQuestions.length < 20) {
          // Дозагружаем больше, чтобы всегда был запас
          preloadQuestions(30).catch(err => console.warn('[preload] Background preload failed:', err));
        }
        
        // Загружаем изображение (может быть уже в кэше)
        beginImageLoad(mpImageEl, mpFrameEl, payload.question.imageUrl, () => {
          // Изображение загрузилось, отправляем сигнал серверу
          mpState.imageLoaded = true;
          if (mpState.socket && mpState.socket.readyState === WebSocket.OPEN && mpState.matchId) {
            mpState.socket.send(JSON.stringify({
              type: 'image-ready',
              payload: { matchId: mpState.matchId },
            }));
          }
          // Если deadline уже пришел, запускаем таймер сразу
          if (mpState.pendingDeadline) {
            startMpTimer(mpState.pendingDeadline);
            mpState.pendingDeadline = null;
          }
        });
        break;

      case 'question-start':
        // Сервер отправляет deadline после того, как оба игрока загрузили изображение
        if (payload.deadline) {
          if (mpState.imageLoaded) {
            // Изображение уже загрузилось, запускаем таймер сразу
            startMpTimer(payload.deadline);
          } else {
            // Изображение еще не загрузилось, сохраняем deadline
            mpState.pendingDeadline = payload.deadline;
          }
        }
        break;

      case 'answer-result':
        // Сразу начинаем предзагрузку следующего изображения, пока показываем результат
        if (mpState.preloadedQuestions.length < 25) {
          preloadQuestions(30).catch(() => {});
        }
        
        if (payload.correct) {
          stopMpTimer();
          setAnswerButtonsDisabled(true);
          mpState.answeredThisRound = true;
          if (payload.playerId === mpState.playerId) {
            mpFeedbackEl.textContent = 'Вы ответили верно!';
            mpFeedbackEl.classList.add('success');
            mpFeedbackEl.classList.remove('error');
            setFrameHighlight(mpFrameEl, 'success');
            showResultChip(mpResultChipEl, 'success', 'Вы ответили первым!');
            profileManager.addXp(profileManager.XP_DUEL_CORRECT);
          } else {
            mpFeedbackEl.textContent = `${mpState.opponentAlias} был быстрее.`;
            mpFeedbackEl.classList.remove('success');
            mpFeedbackEl.classList.add('error');
            showResultChip(mpResultChipEl, 'error', `${mpState.opponentAlias} получил балл`);
          }
          if (payload.scores) {
            mpState.scoreById = payload.scores;
          }
          updateMpScores();
        } else if (payload.playerId === mpState.playerId) {
          mpFeedbackEl.textContent = 'Неверно. Попробуйте снова!';
          mpFeedbackEl.classList.add('error');
          mpFeedbackEl.classList.remove('success');
          setFrameHighlight(mpFrameEl, 'error');
          showResultChip(mpResultChipEl, 'error', 'Неверно');
          mpState.answeredThisRound = true;
          setAnswerButtonsDisabled(true);
        }
        break;

      case 'question-timeout':
        mpState.answeredThisRound = true;
        stopMpTimer();
        setAnswerButtonsDisabled(true);
        mpFeedbackEl.textContent = 'Время вышло! Ни у кого не получилось.';
        mpFeedbackEl.classList.add('error');
        mpFeedbackEl.classList.remove('success');
        setFrameHighlight(mpFrameEl, 'error');
        showResultChip(mpResultChipEl, 'error', 'Время вышло');
        break;

      case 'question-complete':
        mpState.answeredThisRound = true;
        stopMpTimer();
        setAnswerButtonsDisabled(true);
        break;

      case 'match-end': {
        stopMpTimer();
        setAnswerButtonsDisabled(true);
        mpQueueBtn.textContent = 'В бой';
        mpState.matchId = null;
        mpState.currentQuestion = null;
        mpMatchInfoEl.classList.add('hidden');
        mpState.scoreById = {};
        updateMpScores();
        const stats = payload.stats ?? {};
        mpState.statsSnapshot = stats;
        const myStats = stats[mpState.playerId] ?? { correct: 0, wrong: 0, totalTimeMs: 0 };
        const oppStats = stats[mpState.opponentId] ?? { correct: 0, wrong: 0, totalTimeMs: 0 };
        const myTime = (myStats.totalTimeMs / 1000).toFixed(1);
        const oppTime = (oppStats.totalTimeMs / 1000).toFixed(1);
        const didWin = payload.reason === 'completed' && payload.winner === mpState.playerId;

        let headline;
        let chipState;
        if (payload.reason === 'completed') {
          headline = didWin ? 'Вы победили!' : 'Победа за соперником.';
          chipState = didWin ? 'success' : 'error';
          mpFeedbackEl.classList.toggle('success', didWin);
          mpFeedbackEl.classList.toggle('error', !didWin);
          setFrameHighlight(mpFrameEl, didWin ? 'success' : 'error');
          showResultChip(mpResultChipEl, chipState, didWin ? 'Победа!' : 'Поражение');
        } else if (payload.reason === 'player_disconnect') {
          headline = 'Соперник отключился.';
          chipState = 'success';
          mpFeedbackEl.classList.remove('success', 'error');
          mpFeedbackEl.classList.add('success');
          setFrameHighlight(mpFrameEl, 'success');
          showResultChip(mpResultChipEl, 'success', 'Соперник отключился');
        } else if (payload.reason === 'player_left') {
          const leftYou = payload.playerId === mpState.playerId;
          headline = leftYou ? 'Вы покинули матч.' : 'Соперник покинул матч.';
          chipState = leftYou ? 'error' : 'success';
          mpFeedbackEl.classList.remove('success', 'error');
          mpFeedbackEl.classList.add(leftYou ? 'error' : 'success');
          setFrameHighlight(mpFrameEl, leftYou ? 'error' : 'success');
          showResultChip(mpResultChipEl, chipState, leftYou ? 'Вы вышли из матча' : 'Соперник вышел');
        } else {
          headline = payload.message ?? 'Матч завершён.';
          chipState = 'error';
          mpFeedbackEl.classList.remove('success');
          mpFeedbackEl.classList.add('error');
          setFrameHighlight(mpFrameEl, 'error');
          showResultChip(mpResultChipEl, 'error', payload.message ?? 'Матч завершён');
        }

        mpFeedbackEl.textContent = headline;

        if (mpTargetEl) {
          const durationText =
            typeof payload.durationMs === 'number'
              ? `Матч длился ${(payload.durationMs / 1000).toFixed(1)} с`
              : 'Матч завершён';
          mpTargetEl.textContent = durationText;
        }

        // Записываем результат и получаем полученный опыт
        const xpBefore = profileManager.getSnapshot().totalXp;
        profileManager.recordDuelResult({
          won: didWin,
          correct: myStats.correct,
          wrong: myStats.wrong,
          opponentRating: payload.opponentRating || 1000, // Рейтинг соперника, если есть
        });
        const xpAfter = profileManager.getSnapshot().totalXp;
        const xpGained = xpAfter - xpBefore;

        // Показываем модальное окно со статистикой
        showMatchStats({
          headline,
          didWin,
          myStats,
          oppStats,
          opponentAlias: mpState.opponentAlias,
          durationMs: payload.durationMs,
          totalQuestions: payload.totalQuestions,
          xpGained,
        });
        break;
      }

      case 'player-update':
        if (payload.playerId === mpState.playerId) {
          mpState.alias = payload.alias;
          mpPlayerSelfEl.textContent = `Вы (${payload.alias})`;
          showResultChip(mpResultChipEl, null);
        } else if (payload.playerId === mpState.opponentId) {
          mpState.opponentAlias = payload.alias;
          mpPlayerOpponentEl.textContent = payload.alias;
          showResultChip(mpResultChipEl, null);
        }
        break;

      case 'alias-updated':
        if (payload.alias && payload.playerId === mpState.playerId) {
          mpState.alias = payload.alias;
          mpPlayerSelfEl.textContent = `Вы (${payload.alias})`;
          showResultChip(mpResultChipEl, null);
        }
        break;

      case 'error':
        const errorMsg = payload.message ?? 'Ошибка';
        setMpStatus(errorMsg);
        // Если ошибка связана с ником, показываем уведомление
        if (errorMsg.includes('имя') || errorMsg.includes('ник') || errorMsg.includes('занято') || errorMsg.includes('недопустим')) {
          showAlert(errorMsg);
        }
        break;

      default:
        console.warn('Unhandled message', message);
    }
  });
  } catch (error) {
    console.error('[connectSocket] Failed to create WebSocket:', error);
    setMpStatus('Ошибка подключения. Проверьте, что сервер запущен на порту 3000.');
    if (mpQueueBtn) mpQueueBtn.disabled = true;
  }
}

connectSocket();

function toggleQueue() {
  if (!mpState.socket || mpState.socket.readyState !== WebSocket.OPEN) return;
  if (mpState.matchId) {
    mpState.socket.send(JSON.stringify({ type: 'leave-match' }));
    setMpStatus('Вы покинули матч.');
    mpMatchInfoEl.classList.add('hidden');
    mpState.matchId = null;
    mpQueueBtn.textContent = 'В бой';
    setFrameHighlight(mpFrameEl, null);
    stopMpTimer();
    setAnswerButtonsDisabled(true);
    return;
  }
  if (mpState.queued) {
    mpState.socket.send(JSON.stringify({ type: 'leave-queue' }));
  } else {
    mpState.socket.send(JSON.stringify({ type: 'join-queue' }));
  }
}

mpQueueBtn.addEventListener('click', toggleQueue);

function answerMultiplayer(event) {
  if (!mpState.matchId || !mpState.currentQuestion || !mpState.socket) return;
  if (mpState.answeredThisRound) return;
  mpState.answeredThisRound = true;
  setAnswerButtonsDisabled(true);
  
  // Сразу начинаем предзагрузку следующего изображения после ответа
  if (mpState.preloadedQuestions.length < 25) {
    preloadQuestions(30).catch(() => {});
  }
  
  const payload = {
    type: 'answer',
    payload: {
      matchId: mpState.matchId,
      questionId: mpState.currentQuestion.questionId,
      answer: event.currentTarget.dataset.answer,
    },
  };
  mpState.socket.send(JSON.stringify(payload));
}

mpAnswerButtons.forEach((button) => {
  button.addEventListener('click', answerMultiplayer);
});

// UI обработчики для новых функций
const profileQuestsBtn = document.getElementById('profile-quests');
const profileStatsBtn = document.getElementById('profile-stats');
const profileLeaderboardBtn = document.getElementById('profile-leaderboard');
const profileAboutBtn = document.getElementById('profile-about');

const questsBackdrop = document.getElementById('quests-backdrop');
const questsModal = document.getElementById('quests-modal');
const questsListEl = document.getElementById('quests-list');
const dailyBonusEl = document.getElementById('daily-bonus');
const questsCloseBtn = document.getElementById('quests-close');

const statsBackdrop = document.getElementById('stats-backdrop');
const statsModal = document.getElementById('stats-modal');
const statsContentEl = document.getElementById('stats-content');
const statsCloseBtn = document.getElementById('stats-close');

const leaderboardBackdrop = document.getElementById('leaderboard-backdrop');
const leaderboardModal = document.getElementById('leaderboard-modal');
const leaderboardContentEl = document.getElementById('leaderboard-content');
const leaderboardCloseBtn = document.getElementById('leaderboard-close');

// Функции для заданий
function renderQuests() {
  if (!questsListEl) return;
  const quests = profileManager.getDailyQuests();
  questsListEl.innerHTML = '';
  
  if (!quests.length) {
    questsListEl.innerHTML = '<p>Нет активных заданий</p>';
    return;
  }
  
  quests.forEach((quest) => {
    const entry = document.createElement('div');
    entry.className = `quest-entry${quest.completed ? ' completed' : ''}`;
    const progress = Math.min((quest.progress / quest.target) * 100, 100);
    entry.innerHTML = `
      <div class="quest-info">
        <h3>${quest.title}</h3>
        <p>${quest.description}</p>
      </div>
      <div class="quest-progress">
        <div class="quest-progress-bar">
          <div class="quest-progress-fill" style="width: ${progress}%"></div>
        </div>
        <span class="quest-progress-text">${quest.progress} / ${quest.target}</span>
      </div>
      <div class="quest-reward">+${quest.xp} XP</div>
    `;
    questsListEl.appendChild(entry);
  });
}

function renderDailyBonus() {
  if (!dailyBonusEl) return;
  const canClaim = profileManager.canClaimDailyBonus();
  const snapshot = profileManager.getSnapshot();
  const streak = snapshot.dailyBonus?.streak || 0;
  
  if (canClaim) {
    dailyBonusEl.innerHTML = `
      <div class="daily-bonus-card">
        <h3>Ежедневный бонус</h3>
        <p>Серия: ${streak} дней</p>
        <p>Награда: ${50 + streak * 10} XP</p>
        <button id="claim-daily-bonus-btn" class="primary-button">Забрать награду</button>
      </div>
    `;
    const claimBtn = document.getElementById('claim-daily-bonus-btn');
    if (claimBtn) {
      claimBtn.addEventListener('click', () => {
        const result = profileManager.claimDailyBonus();
        if (result) {
          showAchievementToast({ title: 'Ежедневный бонус!', description: `Получено ${result.xp} XP`, xp: result.xp });
          renderDailyBonus();
        }
      });
    }
  } else {
    dailyBonusEl.innerHTML = `
      <div class="daily-bonus-card claimed">
        <h3>Ежедневный бонус</h3>
        <p>Серия: ${streak} дней</p>
        <p>Уже получено сегодня</p>
      </div>
    `;
  }
}

function renderWeeklyChallenges() {
  const weeklyListEl = document.getElementById('weekly-challenges-list');
  if (!weeklyListEl) return;
  const challenges = profileManager.getWeeklyChallenges();
  weeklyListEl.innerHTML = '';
  
  if (!challenges.length) {
    weeklyListEl.innerHTML = '<p>Нет активных вызовов</p>';
    return;
  }
  
  challenges.forEach((challenge) => {
    const entry = document.createElement('div');
    entry.className = `quest-entry${challenge.completed ? ' completed' : ''}`;
    const progress = Math.min((challenge.progress / challenge.target) * 100, 100);
    entry.innerHTML = `
      <div class="quest-info">
        <h3>${challenge.title}</h3>
        <p>${challenge.description}</p>
        ${challenge.reward ? `<p class="quest-reward-info">Награда: ${challenge.reward}</p>` : ''}
      </div>
      <div class="quest-progress">
        <div class="quest-progress-bar">
          <div class="quest-progress-fill" style="width: ${progress}%"></div>
        </div>
        <span class="quest-progress-text">${challenge.progress} / ${challenge.target}</span>
      </div>
      <div class="quest-reward">
        +${challenge.xp} XP
        ${challenge.completed && !challenge.claimed ? `<button class="claim-btn" data-challenge-id="${challenge.id}">Забрать</button>` : ''}
        ${challenge.claimed ? '<span class="claimed-badge">Получено</span>' : ''}
      </div>
    `;
    weeklyListEl.appendChild(entry);
    
    // Обработчик кнопки "Забрать"
    if (challenge.completed && !challenge.claimed) {
      const claimBtn = entry.querySelector('.claim-btn');
      if (claimBtn) {
        claimBtn.addEventListener('click', () => {
          const result = profileManager.claimWeeklyReward(challenge.id);
          if (result) {
            showAchievementToast({ title: 'Вызов выполнен!', description: `Получено ${result.xp} XP + ${result.reward}`, xp: result.xp });
            renderWeeklyChallenges();
            renderProfile(profileManager.getSnapshot()); // Обновляем профиль для отображения множителей
          }
        });
      }
    }
  });
}

function renderMiniGoals() {
  const miniListEl = document.getElementById('mini-goals-list');
  const activeMiniEl = document.getElementById('active-mini-goals');
  if (!miniListEl || !activeMiniEl) return;
  
  const available = profileManager.getAvailableMiniGoals();
  const active = profileManager.getActiveMiniGoals();
  
  // Доступные мини-цели
  miniListEl.innerHTML = '';
  if (!available.length) {
    miniListEl.innerHTML = '<p>Все мини-цели активны</p>';
  } else {
    available.forEach((goal) => {
      const entry = document.createElement('div');
      entry.className = 'quest-entry';
      entry.innerHTML = `
        <div class="quest-info">
          <h3>${goal.title}</h3>
          <p>${goal.description}</p>
          <p class="quest-time-limit">Время: ${goal.timeLimit / 60000} минут</p>
        </div>
        <div class="quest-reward">+${goal.xp} XP</div>
        <button class="start-mini-goal-btn" data-goal-id="${goal.id}">Начать</button>
      `;
      miniListEl.appendChild(entry);
      
      const startBtn = entry.querySelector('.start-mini-goal-btn');
      if (startBtn) {
        startBtn.addEventListener('click', () => {
          const result = profileManager.startMiniGoal(goal.id);
          if (result) {
            renderMiniGoals();
            showAchievementToast({ title: 'Мини-цель начата!', description: goal.description, xp: 0 });
          }
        });
      }
    });
  }
  
  // Активные мини-цели
  activeMiniEl.innerHTML = '';
  if (active.length === 0) {
    activeMiniEl.innerHTML = '<p>Нет активных мини-целей</p>';
  } else {
    active.forEach((goal) => {
      const entry = document.createElement('div');
      entry.className = 'quest-entry active-mini-goal';
      const now = Date.now();
      const startTime = goal.startTime || now;
      const elapsed = now - startTime;
      const remaining = Math.max(0, (goal.timeLimit || 0) - elapsed);
      const minutesLeft = Math.floor(remaining / 60000);
      const secondsLeft = Math.floor((remaining % 60000) / 1000);
      const progress = goal.progress || 0;
      const target = goal.target || 1;
      const progressPercent = Math.min(100, (progress / target) * 100);
      
      entry.innerHTML = `
        <div class="quest-info">
          <h3>${goal.title || 'Мини-цель'}</h3>
          <p>${goal.description || ''}</p>
          <p class="quest-time-remaining">Осталось: ${minutesLeft}:${secondsLeft.toString().padStart(2, '0')}</p>
        </div>
        <div class="quest-progress">
          <div class="quest-progress-bar">
            <div class="quest-progress-fill" style="width: ${progressPercent}%"></div>
          </div>
          <span class="quest-progress-text">${progress} / ${target}</span>
        </div>
        <div class="quest-reward">+${goal.xp || 0} XP</div>
      `;
      activeMiniEl.appendChild(entry);
    });
  }
}

function openQuestsModal() {
  if (!questsModal || !questsBackdrop) return;
  closeProfileSidebar(); // Закрываем sidebar при открытии модального окна
  questsBackdrop.classList.remove('hidden');
  questsModal.classList.remove('hidden');
  
  // Обновляем задания с сервера перед отображением
  profileManager.loadQuestsFromServer().then(() => {
    renderQuests();
    renderDailyBonus();
    renderWeeklyChallenges();
    renderMiniGoals();
  }).catch(() => {
    // Если не удалось загрузить, используем текущие
    renderQuests();
    renderDailyBonus();
    renderWeeklyChallenges();
    renderMiniGoals();
  });
  
  // Обновляем активные мини-цели каждую секунду
  if (window.miniGoalsInterval) {
    clearInterval(window.miniGoalsInterval);
  }
  window.miniGoalsInterval = setInterval(() => {
    renderMiniGoals();
  }, 1000);
}

function closeQuestsModal() {
  if (!questsModal || !questsBackdrop) return;
  questsBackdrop.classList.add('hidden');
  questsModal.classList.add('hidden');
  if (window.miniGoalsInterval) {
    clearInterval(window.miniGoalsInterval);
    window.miniGoalsInterval = null;
  }
}

// Переключение вкладок в модальном окне заданий
const questTabs = document.querySelectorAll('.quest-tab');
const questContents = document.querySelectorAll('.quests-content');
questTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;
    questTabs.forEach(t => t.classList.remove('active'));
    questContents.forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const targetContent = document.getElementById(`quests-${targetTab}-content`);
    if (targetContent) {
      targetContent.classList.add('active');
    }
  });
});

// Функции для статистики
function renderStats() {
  if (!statsContentEl) return;
  const snapshot = profileManager.getSnapshot();
  const stats = snapshot.stats;
  const rating = profileManager.getRating();
  
  const accuracy = stats.totalAnswers > 0 
    ? ((stats.totalCorrect / stats.totalAnswers) * 100).toFixed(1)
    : '0.0';
  
  statsContentEl.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Общая статистика</h3>
        <p>Всего ответов: ${stats.totalAnswers || 0}</p>
        <p>Правильных: ${stats.totalCorrect || 0}</p>
        <p>Точность: ${accuracy}%</p>
        <p>Лучшая серия: ${stats.bestStreak || 0}</p>
      </div>
      <div class="stat-card">
        <h3>Дуэли</h3>
        <p>Матчей: ${stats.duelMatches || 0}</p>
        <p>Побед: ${stats.duelWins || 0}</p>
        <p>Поражений: ${stats.duelLosses || 0}</p>
        <p>Правильных в дуэлях: ${stats.duelCorrect || 0}</p>
      </div>
      <div class="stat-card">
        <h3>Рейтинг</h3>
        <p>Рейтинг: ${rating.rating}</p>
        <p>Ранг: ${rating.rank}</p>
        <p>Уровень: ${snapshot.level}</p>
        <p>Всего XP: ${snapshot.totalXp}</p>
      </div>
    </div>
  `;
}

function openStatsModal() {
  if (!statsModal || !statsBackdrop) return;
  closeProfileSidebar(); // Закрываем sidebar при открытии модального окна
  statsBackdrop.classList.remove('hidden');
  statsModal.classList.remove('hidden');
  renderStats();
}

function closeStatsModal() {
  if (!statsModal || !statsBackdrop) return;
  statsBackdrop.classList.add('hidden');
  statsModal.classList.add('hidden');
}

// Функции для лидерборда
async function renderLeaderboard() {
  if (!leaderboardContentEl) return;
  leaderboardContentEl.innerHTML = '<p>Загрузка...</p>';
  
  // В Яндекс Играх можно использовать leaderboards API
  // Пока показываем локальный рейтинг игрока
  const snapshot = profileManager.getSnapshot();
  const rating = profileManager.getRating();
  
  leaderboardContentEl.innerHTML = `
    <div class="leaderboard-info">
      <h3>Ваш рейтинг</h3>
      <p>Рейтинг: ${rating.rating}</p>
      <p>Ранг: ${rating.rank}</p>
      <p class="leaderboard-note">Глобальная таблица лидеров будет доступна после публикации в Яндекс Играх</p>
    </div>
  `;
  
  // TODO: Интеграция с Яндекс Игры Leaderboards API
  // if (window.YaGames && window.YaGames.getLeaderboards) {
  //   const leaderboards = await window.YaGames.getLeaderboards();
  //   // Отобразить таблицу лидеров
  // }
}

function openLeaderboardModal() {
  if (!leaderboardModal || !leaderboardBackdrop) return;
  closeProfileSidebar(); // Закрываем sidebar при открытии модального окна
  leaderboardBackdrop.classList.remove('hidden');
  leaderboardModal.classList.remove('hidden');
  renderLeaderboard();
}

function closeLeaderboardModal() {
  if (!leaderboardModal || !leaderboardBackdrop) return;
  leaderboardBackdrop.classList.add('hidden');
  leaderboardModal.classList.add('hidden');
}

// Обработчики событий
profileQuestsBtn?.addEventListener('click', openQuestsModal);
questsCloseBtn?.addEventListener('click', closeQuestsModal);
questsBackdrop?.addEventListener('click', closeQuestsModal);

profileStatsBtn?.addEventListener('click', openStatsModal);
statsCloseBtn?.addEventListener('click', closeStatsModal);
statsBackdrop?.addEventListener('click', closeStatsModal);

profileLeaderboardBtn?.addEventListener('click', openLeaderboardModal);
leaderboardCloseBtn?.addEventListener('click', closeLeaderboardModal);
leaderboardBackdrop?.addEventListener('click', closeLeaderboardModal);

// Модальное окно "Разработчики и правила"
const aboutBackdrop = document.getElementById('about-backdrop');
const aboutModal = document.getElementById('about-modal');
const aboutCloseBtn = document.getElementById('about-close');
const aboutOkBtn = document.getElementById('about-ok');

function openAboutModal() {
  if (!aboutModal || !aboutBackdrop) return;
  closeProfileSidebar();
  aboutBackdrop.classList.remove('hidden');
  aboutModal.classList.remove('hidden');
}

function closeAboutModal() {
  if (!aboutModal || !aboutBackdrop) return;
  aboutBackdrop.classList.add('hidden');
  aboutModal.classList.add('hidden');
}

profileAboutBtn?.addEventListener('click', openAboutModal);
aboutCloseBtn?.addEventListener('click', closeAboutModal);
aboutOkBtn?.addEventListener('click', closeAboutModal);
aboutBackdrop?.addEventListener('click', closeAboutModal);

function showMatchStats({ headline, didWin, myStats, oppStats, opponentAlias, durationMs, totalQuestions, xpGained }) {
  if (!matchStatsModal || !matchStatsContent) return;
  
  const myTotal = myStats.correct + myStats.wrong;
  const oppTotal = oppStats.correct + oppStats.wrong;
  const myAvgTime = myTotal > 0 ? (myStats.totalTimeMs / myTotal / 1000).toFixed(2) : '0.00';
  const oppAvgTime = oppTotal > 0 ? (oppStats.totalTimeMs / oppTotal / 1000).toFixed(2) : '0.00';
  const myAccuracy = myTotal > 0 ? ((myStats.correct / myTotal) * 100).toFixed(1) : '0.0';
  const oppAccuracy = oppTotal > 0 ? ((oppStats.correct / oppTotal) * 100).toFixed(1) : '0.0';
  const duration = durationMs ? (durationMs / 1000).toFixed(1) : '0.0';
  
  matchStatsContent.innerHTML = `
    <div class="match-stats-header ${didWin ? 'win' : 'loss'}">
      <h3>${headline}</h3>
    </div>
    <div class="match-stats-grid">
      <div class="match-stats-player">
        <h4>Вы</h4>
        <div class="match-stats-item">
          <span class="match-stats-label">Правильных ответов:</span>
          <span class="match-stats-value success">${myStats.correct}</span>
        </div>
        <div class="match-stats-item">
          <span class="match-stats-label">Неправильных ответов:</span>
          <span class="match-stats-value error">${myStats.wrong}</span>
        </div>
        <div class="match-stats-item">
          <span class="match-stats-label">Точность:</span>
          <span class="match-stats-value">${myAccuracy}%</span>
        </div>
        <div class="match-stats-item">
          <span class="match-stats-label">Среднее время ответа:</span>
          <span class="match-stats-value">${myAvgTime} с</span>
        </div>
        <div class="match-stats-item">
          <span class="match-stats-label">Общее время:</span>
          <span class="match-stats-value">${(myStats.totalTimeMs / 1000).toFixed(1)} с</span>
        </div>
      </div>
      <div class="match-stats-player">
        <h4>${opponentAlias}</h4>
        <div class="match-stats-item">
          <span class="match-stats-label">Правильных ответов:</span>
          <span class="match-stats-value success">${oppStats.correct}</span>
        </div>
        <div class="match-stats-item">
          <span class="match-stats-label">Неправильных ответов:</span>
          <span class="match-stats-value error">${oppStats.wrong}</span>
        </div>
        <div class="match-stats-item">
          <span class="match-stats-label">Точность:</span>
          <span class="match-stats-value">${oppAccuracy}%</span>
        </div>
        <div class="match-stats-item">
          <span class="match-stats-label">Среднее время ответа:</span>
          <span class="match-stats-value">${oppAvgTime} с</span>
        </div>
        <div class="match-stats-item">
          <span class="match-stats-label">Общее время:</span>
          <span class="match-stats-value">${(oppStats.totalTimeMs / 1000).toFixed(1)} с</span>
        </div>
      </div>
    </div>
    <div class="match-stats-summary">
      <div class="match-stats-item">
        <span class="match-stats-label">Длительность матча:</span>
        <span class="match-stats-value">${duration} с</span>
      </div>
      <div class="match-stats-item">
        <span class="match-stats-label">Всего вопросов:</span>
        <span class="match-stats-value">${totalQuestions || 0}</span>
      </div>
      <div class="match-stats-item highlight">
        <span class="match-stats-label">Получено опыта:</span>
        <span class="match-stats-value xp-gain">+${xpGained} XP</span>
      </div>
    </div>
  `;
  
  matchStatsBackdrop.classList.remove('hidden');
  matchStatsModal.classList.remove('hidden');
}

function closeMatchStatsModal() {
  if (!matchStatsModal || !matchStatsBackdrop) return;
  matchStatsBackdrop.classList.add('hidden');
  matchStatsModal.classList.add('hidden');
}

matchStatsCloseBtn?.addEventListener('click', closeMatchStatsModal);
matchStatsBackdrop?.addEventListener('click', closeMatchStatsModal);

// Проверка ежедневного бонуса при загрузке (init уже вызывается выше)

