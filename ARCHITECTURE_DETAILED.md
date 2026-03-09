# 🏗️ Подробная архитектура системы для Яндекс Игр

## 📋 Содержание

1. [Общая архитектура](#общая-архитектура)
2. [Компоненты системы](#компоненты-системы)
3. [Поток данных Single Player](#поток-данных-single-player)
4. [Поток данных Multiplayer](#поток-данных-multiplayer)
5. [WebSocket соединение](#websocket-соединение)
6. [Жизненный цикл игры](#жизненный-цикл-игры)
7. [Хранение данных](#хранение-данных)
8. [Деплой и настройка](#деплой-и-настройка)

---

## 🎯 Общая архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                         ПОЛЬЗОВАТЕЛЬ                           │
│                    Открывает игру в браузере                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ЯНДЕКС ИГРЫ (CDN)                           │
│  https://games.yandex.ru/your-game-id                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  index.html                                               │  │
│  │  ├── styles.css (загружается с CDN)                      │  │
│  │  ├── main.js (загружается с CDN)                         │  │
│  │  └── logo.png (загружается с CDN)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ⚠️  ТОЛЬКО статические файлы (HTML/CSS/JS)                   │
│  ❌  НЕТ backend сервера, НЕТ WebSocket                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP/WebSocket запросы
                         │ к отдельному backend
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              ВАШ BACKEND СЕРВЕР (отдельно!)                    │
│         https://api.your-domain.com                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Node.js сервер (server/index.js)                         │  │
│  │  ├── Express API (REST endpoints)                         │  │
│  │  │   ├── GET  /api/questions/single                       │  │
│  │  │   ├── POST /api/questions/single/:id/answer            │  │
│  │  │   ├── GET  /api/questions/batch                        │  │
│  │  │   ├── GET  /api/quests                                 │  │
│  │  │   └── GET  /api/alias/check                            │  │
│  │  │                                                         │  │
│  │  └── WebSocket Server (ws://api.your-domain.com/ws)       │  │
│  │      └── Обработка multiplayer матчей                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Данные (в памяти сервера)                                │  │
│  │  ├── imageManifest.json (загружается при старте)         │  │
│  │  ├── quests.json (загружается при старте)                │  │
│  │  ├── bannedWords.json (загружается при старте)           │  │
│  │  ├── matches Map (активные матчи)                        │  │
│  │  ├── players Map (активные игроки)                       │  │
│  │  └── waitingPlayers Array (очередь игроков)              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ Загрузка изображений
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              ВНЕШНИЕ ИСТОЧНИКИ ИЗОБРАЖЕНИЙ                     │
│  ├── Pexels (реальные фото)                                    │
│  ├── LoremFlickr (реальные фото)                               │
│  ├── Pollinations AI (AI изображения)                          │
│  ├── Lexica (AI изображения)                                   │
│  └── Google Images (AI изображения через API)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Компоненты системы

### 1. **Клиентская часть (Яндекс Игры)**

**Файлы:**
- `client/index.html` - структура страницы
- `client/main.js` - вся логика игры
- `client/styles.css` - стили

**Что делает:**
- Отображает интерфейс игры
- Отправляет HTTP запросы к backend
- Подключается через WebSocket для multiplayer
- Обрабатывает ответы и обновляет UI
- Кэширует изображения локально

**Где работает:**
- Браузер пользователя
- Загружается с CDN Яндекс Игр

### 2. **Backend сервер (Ваш хостинг)**

**Файлы:**
- `server/index.js` - основной сервер

**Что делает:**
- Обрабатывает REST API запросы
- Управляет WebSocket соединениями
- Создает вопросы с изображениями
- Управляет multiplayer матчами
- Валидирует ники игроков
- Отслеживает статистику

**Где работает:**
- Ваш VPS/Cloud сервер
- Отдельный домен (например: `api.your-domain.com`)

### 3. **Данные**

**Файлы на сервере:**
- `server/data/imageManifest.json` - список всех изображений
- `server/data/quests.json` - задания и достижения
- `server/data/bannedWords.json` - запрещенные слова

**В памяти сервера:**
- `matches Map` - активные матчи
- `players Map` - активные игроки
- `waitingPlayers Array` - очередь для матчмейкинга
- `usedAliases Set` - занятые ники

---

## 📡 Поток данных Single Player

### Шаг 1: Пользователь открывает игру

```
1. Пользователь открывает https://games.yandex.ru/your-game-id
2. Яндекс Игры отдают HTML файл
3. Браузер загружает CSS и JS с CDN
4. JavaScript код выполняется в браузере
```

**Что происходит в коде (`client/main.js`):**

```javascript
// Определяется базовый URL для API
const API_BASE = 
  window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : 'https://api.your-domain.com'; // Ваш backend

const WS_BASE = API_BASE.replace(/^http/, 'ws');
```

### Шаг 2: Инициализация Single Player режима

```
1. Пользователь нажимает "Одиночная игра"
2. Клиент отправляет GET запрос: /api/questions/single
3. Backend создает вопрос с изображением
4. Backend возвращает JSON с URL изображения
```

**Детальный поток:**

```
┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │
└────┬─────┘                    └────┬─────┘
     │                               │
     │  1. GET /api/questions/single │
     ├──────────────────────────────>│
     │                               │
     │                               │ 2. loadImageManifest()
     │                               │    └─> Читает imageManifest.json
     │                               │
     │                               │ 3. drawNextImage()
     │                               │    └─> Выбирает случайное изображение
     │                               │        из shuffledQueue
     │                               │
     │                               │ 4. createQuestion()
     │                               │    ├─> Создает questionId (UUID)
     │                               │    ├─> Сохраняет в activeQuestions Map
     │                               │    └─> Возвращает:
     │                               │        {
     │                               │          questionId: "...",
     │                               │          imageUrl: "https://...",
     │                               │          prompt: "...",
     │                               │          source: {...}
     │                               │        }
     │                               │
     │  5. Response JSON             │
     │<──────────────────────────────┤
     │                               │
     │  6. beginImageLoad(imageUrl)  │
     │     └─> Загружает изображение │
     │         из внешнего источника │
     │                               │
     │  7. Когда изображение загружено│
     │     └─> Показывает вопрос     │
     │         игроку                │
     │                               │
```

**Код на клиенте:**

```javascript
// client/main.js
async function loadSingleQuestion() {
  const resp = await fetch(`${API_BASE}/api/questions/single`);
  const data = await resp.json();
  
  // data.question содержит:
  // {
  //   questionId: "uuid-here",
  //   imageUrl: "https://pexels.com/photo.jpg",
  //   prompt: "selfie...",
  //   source: { name: "Pexels", license: "..." }
  // }
  
  singleState.question = data.question;
  beginImageLoad(singleImageEl, singleFrameEl, data.question.imageUrl);
}
```

**Код на сервере:**

```javascript
// server/index.js
app.get('/api/questions/single', (_req, res) => {
  const question = createQuestion();
  // question = {
  //   questionId: "abc-123",
  //   imageUrl: "https://...",
  //   prompt: "...",
  //   source: {...}
  // }
  res.json({ question });
});

function createQuestion() {
  // Выбирает случайное изображение
  const datasetItem = drawNextImage();
  
  // Создает уникальный ID вопроса
  const questionId = uuid();
  
  // Сохраняет в памяти для проверки ответа
  activeQuestions.set(questionId, {
    answer: datasetItem.type, // 'real' или 'ai'
    imageId: datasetItem.id,
    createdAt: Date.now(),
    payload: datasetItem,
  });
  
  return {
    questionId,
    imageUrl: datasetItem.url,
    prompt: datasetItem.prompt,
    source: datasetItem.source,
  };
}
```

### Шаг 3: Игрок отвечает

```
1. Игрок нажимает "Реальное" или "AI"
2. Клиент отправляет POST запрос с ответом
3. Backend проверяет правильность
4. Backend возвращает результат + следующий вопрос
```

**Детальный поток:**

```
┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │
└────┬─────┘                    └────┬─────┘
     │                               │
     │  Игрок нажал "AI"             │
     │                               │
     │  1. POST /api/questions/      │
     │     single/:questionId/answer │
     │     Body: { answer: "ai" }    │
     ├──────────────────────────────>│
     │                               │
     │                               │ 2. Находит вопрос в activeQuestions
     │                               │    const stored = activeQuestions.get(questionId)
     │                               │
     │                               │ 3. Проверяет ответ:
     │                               │    const correct = stored.answer === "ai"
     │                               │
     │                               │ 4. Удаляет вопрос из памяти:
     │                               │    activeQuestions.delete(questionId)
     │                               │
     │                               │ 5. Создает следующий вопрос:
     │                               │    const nextQuestion = createQuestion()
     │                               │
     │  6. Response JSON             │
     │<──────────────────────────────┤
     │  {
     │    correct: true/false,
     │    correctAnswer: "real"|"ai",
     │    nextQuestion: {...},
     │    imageMeta: {...}
     │  }
     │                               │
     │  7. Обновляет UI              │
     │     - Показывает результат    │
     │     - Добавляет XP            │
     │     - Загружает следующий     │
     │       вопрос                  │
     │                               │
```

**Код на клиенте:**

```javascript
async function submitSingleAnswer(answer) {
  const resp = await fetch(
    `${API_BASE}/api/questions/single/${singleState.question.questionId}/answer`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer })
    }
  );
  
  const data = await resp.json();
  
  if (data.correct) {
    // Правильный ответ
    addXp(10);
    showResultChip(singleResultChipEl, 'success', 'Правильно!');
  } else {
    // Неправильный ответ
    showResultChip(singleResultChipEl, 'error', 'Неверно');
  }
  
  // Загружаем следующий вопрос
  if (data.nextQuestion) {
    singleState.question = data.nextQuestion;
    beginImageLoad(singleImageEl, singleFrameEl, data.nextQuestion.imageUrl);
  }
}
```

**Код на сервере:**

```javascript
app.post('/api/questions/single/:questionId/answer', (req, res) => {
  const { questionId } = req.params;
  const { answer } = req.body;
  
  // Находим вопрос в памяти
  const stored = activeQuestions.get(questionId);
  if (!stored) {
    return res.status(404).json({ error: 'question_not_found' });
  }
  
  // Проверяем ответ
  const correct = stored.answer === answer;
  
  // Удаляем вопрос (больше не нужен)
  activeQuestions.delete(questionId);
  
  // Создаем следующий вопрос
  const nextQuestion = createQuestion({
    excludeIds: [stored.imageId] // Не повторяем это изображение
  });
  
  res.json({
    correct,
    correctAnswer: stored.answer,
    nextQuestion,
    imageMeta: {
      id: stored.imageId,
      source: stored.payload.source,
    }
  });
});
```

---

## 🎮 Поток данных Multiplayer

### Шаг 1: Подключение к WebSocket

```
1. Пользователь нажимает "Мультиплеер"
2. Клиент открывает WebSocket соединение
3. Сервер создает объект player и добавляет в очередь
4. Если есть другой игрок в очереди - создается матч
```

**Детальный поток:**

```
┌──────────┐                    ┌──────────┐
│  Client  │                    │  Server  │
└────┬─────┘                    └────┬─────┘
     │                               │
     │  1. new WebSocket(WS_BASE + "/ws")
     ├──────────────────────────────>│
     │                               │
     │                               │ 2. wss.on('connection')
     │                               │    ├─> Генерирует player.id (UUID)
     │                               │    ├─> Генерирует defaultAlias
     │                               │    ├─> Создает объект player:
     │                               │    │     {
     │                               │    │       id: "player-uuid",
     │                               │    │       alias: "Игрок-1234",
     │                               │    │       socket: WebSocket,
     │                               │    │       matchId: null
     │                               │    │     }
     │                               │    ├─> Регистрирует alias:
     │                               │    │     usedAliases.add(alias)
     │                               │    ├─> Сохраняет player:
     │                               │    │     players.set(player.id, player)
     │                               │    │
     │                               │    └─> Вызывает queueOrMatchPlayer(player)
     │                               │
     │  3. { type: "connected",      │
     │      payload: {               │
     │        playerId: "...",       │
     │        alias: "Игрок-1234"    │
     │      }                        │
     │  }                            │
     │<──────────────────────────────┤
     │                               │
     │                               │ 4. queueOrMatchPlayer(player)
     │                               │    ├─> Если waitingPlayers.length > 0:
     │                               │    │   ├─> Берет первого из очереди
     │                               │    │   └─> createMatch(opponent, player)
     │                               │    │
     │                               │    └─> Иначе:
     │                               │        └─> waitingPlayers.push(player)
     │                               │
     │                               │ 5. Если создан матч:
     │                               │    └─> Отправляет "match-start"
     │                               │
     │  6. { type: "match-start" или │
     │      "queued"                 │
     │  }                            │
     │<──────────────────────────────┤
     │                               │
```

**Код на клиенте:**

```javascript
let mpWs = null;

function connectMultiplayer() {
  mpWs = new WebSocket(WS_BASE + '/ws');
  
  mpWs.onopen = () => {
    console.log('WebSocket connected');
  };
  
  mpWs.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleMultiplayerMessage(message);
  };
  
  mpWs.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  mpWs.onclose = () => {
    console.log('WebSocket closed');
  };
}

function handleMultiplayerMessage(message) {
  switch (message.type) {
    case 'connected':
      mpState.playerId = message.payload.playerId;
      mpState.alias = message.payload.alias;
      break;
      
    case 'match-start':
      // Матч начался
      mpState.matchId = message.payload.matchId;
      mpState.opponent = message.payload.players.find(
        p => p.id !== mpState.playerId
      );
      startMatch(message.payload);
      break;
      
    case 'queued':
      // Игрок в очереди
      mpStatusEl.textContent = 'Ожидание соперника...';
      break;
      
    case 'question':
      // Новый вопрос
      loadMultiplayerQuestion(message.payload.question);
      break;
      
    // ... другие типы сообщений
  }
}
```

**Код на сервере:**

```javascript
const wss = new WebSocketServer({ server, path: '/ws' });
const waitingPlayers = [];
const matches = new Map();
const players = new Map();

wss.on('connection', (socket) => {
  // Генерируем уникальное имя по умолчанию
  let defaultAlias = `Игрок-${Math.floor(Math.random() * 9000 + 1000)}`;
  
  // Проверяем уникальность
  while (!isAliasAvailable(defaultAlias)) {
    defaultAlias = `Игрок-${Math.floor(Math.random() * 9000 + 1000)}`;
  }
  
  const player = {
    id: uuid(),
    alias: defaultAlias,
    socket: socket,
    matchId: null,
  };
  
  // Регистрируем имя
  registerAlias(player.alias);
  players.set(player.id, player);
  
  // Отправляем информацию о подключении
  socket.send(JSON.stringify({
    type: 'connected',
    payload: {
      playerId: player.id,
      alias: player.alias,
    }
  }));
  
  // Добавляем в очередь или создаем матч
  queueOrMatchPlayer(player);
  
  // Обработка сообщений от клиента
  socket.on('message', (raw) => {
    const parsed = JSON.parse(raw);
    handlePlayerMessage(player, parsed);
  });
  
  // Обработка отключения
  socket.on('close', () => {
    removeFromQueue(player);
    if (player.matchId) {
      const match = matches.get(player.matchId);
      if (match) {
        endMatch(match, { reason: 'player_disconnect', playerId: player.id });
      }
    }
    unregisterAlias(player.alias);
    players.delete(player.id);
  });
});

function queueOrMatchPlayer(player) {
  if (waitingPlayers.length > 0) {
    // Есть игрок в очереди - создаем матч
    const opponent = waitingPlayers.shift();
    createMatch(opponent, player);
  } else {
    // Нет игроков - добавляем в очередь
    waitingPlayers.push(player);
    player.socket.send(JSON.stringify({
      type: 'queued',
      payload: { message: 'Waiting for another player...' }
    }));
  }
}
```

### Шаг 2: Создание матча

```
1. Сервер находит двух игроков
2. Создает объект match
3. Отправляет "match-start" обоим игрокам
4. Ждет готовности обоих клиентов
5. Создает первый вопрос
```

**Детальный поток:**

```
┌──────────┐  ┌──────────┐           ┌──────────┐
│ Player A │  │ Player B │           │  Server  │
└────┬─────┘  └────┬─────┘           └────┬─────┘
     │             │                      │
     │             │  Player B подключается│
     │             ├──────────────────────>│
     │             │                      │
     │             │                      │ queueOrMatchPlayer(B)
     │             │                      │ ├─> waitingPlayers = [A, B]
     │             │                      │ └─> waitingPlayers.length === 2
     │             │                      │
     │             │                      │ createMatch(A, B)
     │             │                      │ ├─> Генерирует match.id
     │             │                      │ ├─> Создает объект match:
     │             │                      │ │     {
     │             │                      │ │       id: "match-uuid",
     │             │                      │ │       players: [A, B],
     │             │                      │ │       scores: Map([
     │             │                      │ │         [A.id, 0],
     │             │                      │ │         [B.id, 0]
     │             │                      │ │       ]),
     │             │                      │ │       currentQuestion: null,
     │             │                      │ │       targetScore: 10,
     │             │                      │ │       createdAt: Date.now(),
     │             │                      │ │       stats: Map([...])
     │             │                      │ │     }
     │             │                      │ ├─> matches.set(match.id, match)
     │             │                      │ ├─> A.matchId = match.id
     │             │                      │ └─> B.matchId = match.id
     │             │                      │
     │  "match-start"                     │
     │<───────────────────────────────────┤
     │             │  "match-start"       │
     │             │<─────────────────────┤
     │             │                      │
     │  Показывает информацию о матче    │
     │             │  Показывает информацию│
     │             │                      │
     │  "client-ready" (когда загрузился)│
     ├───────────────────────────────────>│
     │             │  "client-ready"      │
     │             ├──────────────────────>│
     │             │                      │
     │             │                      │ match.clientReadyPlayers.add(A.id)
     │             │                      │ match.clientReadyPlayers.add(B.id)
     │             │                      │
     │             │                      │ if (clientReadyPlayers.size >= 2) {
     │             │                      │   startNextQuestion(match)
     │             │                      │ }
     │             │                      │
     │             │                      │ startNextQuestion()
     │             │                      │ ├─> createQuestion()
     │             │                      │ ├─> match.currentQuestion = question
     │             │                      │ └─> broadcast("question")
     │             │                      │
     │  "question"                        │
     │<───────────────────────────────────┤
     │             │  "question"          │
     │             │<─────────────────────┤
     │             │                      │
```

**Код создания матча:**

```javascript
function createMatch(playerA, playerB) {
  const match = {
    id: uuid(),
    players: [playerA, playerB],
    scores: new Map([
      [playerA.id, 0],
      [playerB.id, 0],
    ]),
    currentQuestion: null,
    targetScore: TARGET_SCORE, // 10
    createdAt: Date.now(),
    usedImageIds: new Set(), // Чтобы не повторять изображения
    questionTimer: null,
    stats: new Map([
      [playerA.id, { correct: 0, wrong: 0, totalTimeMs: 0 }],
      [playerB.id, { correct: 0, wrong: 0, totalTimeMs: 0 }],
    ]),
    totalQuestions: 0,
    clientReadyPlayers: new Set(), // Кто готов начать
    imageReadyPlayers: new Set(),  // У кого загрузилось изображение
  };
  
  matches.set(match.id, match);
  playerA.matchId = match.id;
  playerB.matchId = match.id;
  
  // Отправляем обоим игрокам информацию о матче
  broadcast(match, {
    type: 'match-start',
    payload: {
      matchId: match.id,
      players: match.players.map(p => ({
        id: p.id,
        alias: p.alias,
      })),
      targetScore: match.targetScore,
    }
  });
  
  // Ждем готовности клиентов (таймаут 10 секунд)
  match.startTimeout = setTimeout(() => {
    if (!match.ended && !match.currentQuestion) {
      startNextQuestion(match);
    }
  }, 10000);
}
```

### Шаг 3: Вопрос и ответ в матче

```
1. Сервер создает вопрос и отправляет обоим игрокам
2. Каждый игрок загружает изображение
3. Когда изображение загружено - игрок отправляет "image-ready"
4. Когда оба готовы - запускается таймер (4 секунды)
5. Игроки отвечают
6. Первый правильный ответ побеждает в раунде
```

**Детальный поток:**

```
┌──────────┐  ┌──────────┐           ┌──────────┐
│ Player A │  │ Player B │           │  Server  │
└────┬─────┘  └────┬─────┘           └────┬─────┘
     │             │                      │
     │             │  "question"          │
     │             │<─────────────────────┤
     │  "question" │                      │
     │<────────────┤                      │
     │             │                      │
     │  Загружает изображение            │
     │             │  Загружает изображение│
     │             │                      │
     │  "image-ready" (когда загрузилось)│
     ├───────────────────────────────────>│
     │             │  "image-ready"       │
     │             ├──────────────────────>│
     │             │                      │
     │             │                      │ match.imageReadyPlayers.add(A.id)
     │             │                      │ match.imageReadyPlayers.add(B.id)
     │             │                      │
     │             │                      │ if (imageReadyPlayers.size >= 2) {
     │             │                      │   startQuestionTimer(match)
     │             │                      │ }
     │             │                      │
     │             │                      │ startQuestionTimer()
     │             │                      │ ├─> match.questionStart = Date.now()
     │             │                      │ ├─> match.questionDeadline = start + 4000
     │             │                      │ ├─> match.questionTimer = setTimeout(...)
     │             │                      │ └─> broadcast("question-start")
     │             │                      │
     │  "question-start"                  │
     │<───────────────────────────────────┤
     │             │  "question-start"    │
     │             │<─────────────────────┤
     │             │                      │
     │  Таймер начинает отсчет (4 сек)   │
     │             │  Таймер начинает отсчет│
     │             │                      │
     │  Нажимает "AI" (через 2 сек)      │
     │             │                      │
     │  "answer" {                        │
     │    matchId: "...",                 │
     │    questionId: "...",              │
     │    answer: "ai"                    │
     │  }                                 │
     ├───────────────────────────────────>│
     │             │                      │
     │             │                      │ Проверяет ответ:
     │             │                      │ ├─> Находит question в activeQuestions
     │             │                      │ ├─> correct = stored.answer === "ai"
     │             │                      │ └─> correct === true
     │             │                      │
     │             │                      │ match.questionAnsweredBy = A.id
     │             │                      │ match.scores.set(A.id, score + 1)
     │             │                      │
     │             │                      │ broadcast("answer-result")
     │             │                      │
     │  "answer-result" {                 │
     │    playerId: A.id,                 │
     │    correct: true,                  │
     │    scores: { A: 1, B: 0 }          │
     │  }                                 │
     │<───────────────────────────────────┤
     │             │  "answer-result"     │
     │             │<─────────────────────┤
     │             │                      │
     │  Обновляет счет                    │
     │             │  Обновляет счет      │
     │             │                      │
     │             │                      │ if (score >= 10) {
     │             │                      │   endMatch(match, { winner: A.id })
     │             │                      │ } else {
     │             │                      │   scheduleNextQuestion(match)
     │             │                      │ }
     │             │                      │
```

**Код обработки ответа:**

```javascript
// Server
socket.on('message', (raw) => {
  const parsed = JSON.parse(raw);
  
  if (parsed.type === 'answer') {
    const { matchId, questionId, answer } = parsed.payload;
    const match = matches.get(matchId);
    const stored = activeQuestions.get(questionId);
    
    // Проверяем ответ
    const correct = stored.answer === answer;
    
    if (correct && !match.questionAnsweredBy) {
      // Первый правильный ответ
      match.questionAnsweredBy = player.id;
      const currentScore = match.scores.get(player.id) ?? 0;
      match.scores.set(player.id, currentScore + 1);
      
      // Отправляем результат обоим игрокам
      broadcast(match, {
        type: 'answer-result',
        payload: {
          playerId: player.id,
          correct: true,
          scores: Object.fromEntries(match.scores),
        }
      });
      
      // Проверяем победу
      if (currentScore + 1 >= match.targetScore) {
        endMatch(match, {
          reason: 'completed',
          winner: player.id,
        });
      } else {
        // Следующий вопрос через 400мс
        scheduleNextQuestion(match);
      }
    } else if (!correct) {
      // Неправильный ответ - отправляем только этому игроку
      player.socket.send(JSON.stringify({
        type: 'answer-result',
        payload: {
          playerId: player.id,
          correct: false,
        }
      }));
      
      // Следующий вопрос
      scheduleNextQuestion(match);
    }
  }
});
```

---

## 🔌 WebSocket соединение

### Установка соединения

```
1. Клиент создает WebSocket: new WebSocket('wss://api.your-domain.com/ws')
2. Сервер принимает соединение через WebSocketServer
3. Создается постоянное двустороннее соединение
4. Обе стороны могут отправлять сообщения в любой момент
```

### Формат сообщений

**Все сообщения в формате JSON:**

```javascript
// От клиента к серверу
{
  type: "answer",
  payload: {
    matchId: "match-uuid",
    questionId: "question-uuid",
    answer: "ai" // или "real"
  }
}

// От сервера к клиенту
{
  type: "question",
  payload: {
    matchId: "match-uuid",
    question: {
      questionId: "question-uuid",
      imageUrl: "https://...",
      prompt: "..."
    },
    timeLimitMs: 4000
  }
}
```

### Типы сообщений

**От клиента:**
- `join-queue` - встать в очередь
- `leave-queue` - выйти из очереди
- `set-alias` - изменить имя
- `client-ready` - клиент готов к матчу
- `image-ready` - изображение загружено
- `answer` - ответ на вопрос
- `leave-match` - покинуть матч

**От сервера:**
- `connected` - подключение установлено
- `queued` - игрок в очереди
- `match-start` - матч начался
- `question` - новый вопрос
- `question-start` - таймер запущен
- `answer-result` - результат ответа
- `match-end` - матч завершен
- `error` - ошибка

---

## 🔄 Жизненный цикл игры

### Single Player

```
1. Пользователь открывает игру
2. Выбирает "Одиночная игра"
3. Загружается первый вопрос
4. Игрок отвечает
5. Получает результат + XP
6. Загружается следующий вопрос
7. Повторяется пока игрок не остановится
```

### Multiplayer

```
1. Пользователь выбирает "Мультиплеер"
2. Подключается WebSocket
3. Игрок встает в очередь
4. Находится соперник
5. Создается матч
6. Начинается первый вопрос
7. Игроки отвечают
8. Побеждает первый правильный ответ
9. Счет обновляется
10. Повторяется пока кто-то не наберет 10 очков
11. Матч завершается
12. Показывается статистика
13. Игрок может начать новый матч
```

---

## 💾 Хранение данных

### На сервере (файлы)

**`server/data/imageManifest.json`**
```json
[
  {
    "id": "real-pexels-1",
    "type": "real",
    "url": "https://pexels.com/photo.jpg",
    "source": {
      "name": "Pexels",
      "license": "Pexels License"
    }
  },
  {
    "id": "ai-pollinations-1",
    "type": "ai",
    "url": "https://pollinations.ai/prompt=...",
    "prompt": "selfie realistic",
    "source": {
      "name": "Pollinations AI",
      "license": "CC0"
    }
  }
]
```

**Загружается при старте сервера:**
```javascript
let imageManifest = loadImageManifest();
let manifestById = new Map(imageManifest.map(item => [item.id, item]));
let shuffledQueue = shuffleIds(imageManifest);
```

### В памяти сервера

**`matches Map`** - активные матчи
```javascript
matches = Map {
  "match-uuid-1" => {
    id: "match-uuid-1",
    players: [playerA, playerB],
    scores: Map { "playerA-id" => 5, "playerB-id" => 3 },
    currentQuestion: {...},
    ...
  }
}
```

**`players Map`** - активные игроки
```javascript
players = Map {
  "player-uuid-1" => {
    id: "player-uuid-1",
    alias: "Игрок-1234",
    socket: WebSocket,
    matchId: "match-uuid-1" или null
  }
}
```

**`activeQuestions Map`** - активные вопросы
```javascript
activeQuestions = Map {
  "question-uuid-1" => {
    answer: "real" или "ai",
    imageId: "image-id",
    createdAt: 1234567890,
    payload: {...}
  }
}
```

### На клиенте (браузер)

**LocalStorage:**
```javascript
// client/main.js
const state = {
  alias: localStorage.getItem('alias') || null,
  totalXp: parseInt(localStorage.getItem('totalXp') || '0'),
  level: parseInt(localStorage.getItem('level') || '1'),
  achievements: JSON.parse(localStorage.getItem('achievements') || '[]'),
};
```

**Кэш изображений:**
```javascript
// В памяти браузера
preloadedImages = new Map(); // URL -> Image объект
```

---

## 🚀 Деплой и настройка

### 1. Подготовка backend сервера

```bash
# На вашем VPS сервере

# 1. Установить Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Клонировать репозиторий
git clone https://github.com/your-username/your-game.git
cd your-game

# 3. Установить зависимости
npm install

# 4. Настроить переменные окружения
nano .env
# Добавить:
# PORT=3000
# ALLOWED_ORIGINS=https://games.yandex.ru,https://yandex.ru
```

### 2. Настройка Nginx

```nginx
# /etc/nginx/sites-available/your-game-api

server {
    listen 80;
    server_name api.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. Запуск через PM2

```bash
# Установить PM2
npm install -g pm2

# Запустить сервер
pm2 start server/index.js --name "game-server"

# Сохранить конфигурацию
pm2 save
pm2 startup

# Логи
pm2 logs game-server
```

### 4. Обновление клиентского кода

```javascript
// client/main.js
const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://api.your-domain.com'; // ← Ваш backend домен

const WS_BASE = API_BASE.replace(/^http/, 'ws');
```

### 5. Деплой на Яндекс Игры

1. Собрать клиентские файлы
2. Загрузить на Яндекс Игры через панель разработчика
3. Указать URL игры

---

## 📊 Мониторинг

**Логи сервера:**
```javascript
// Каждую минуту выводится статистика
[monitor] Connections: 150, Matches: 75, Waiting: 0, Players: 150
[monitor] Memory: 120MB / 200MB
```

**Health endpoint:**
```bash
curl https://api.your-domain.com/health
# {"ok":true,"manifestSize":1000}
```

---

## ✅ Итоговая схема работы

```
1. Пользователь → Открывает Яндекс Игры
2. Яндекс Игры → Отдает HTML/CSS/JS с CDN
3. Браузер → Загружает и выполняет JS
4. JS → Подключается к вашему backend через HTTPS/WSS
5. Backend → Обрабатывает запросы и WebSocket
6. Backend → Возвращает вопросы с URL изображений
7. Браузер → Загружает изображения с внешних источников
8. Игрок → Отвечает на вопросы
9. Backend → Проверяет ответы и обновляет статистику
10. Браузер → Обновляет UI и показывает результат
```

---

Это полная архитектура системы! Все компоненты взаимодействуют именно так.



