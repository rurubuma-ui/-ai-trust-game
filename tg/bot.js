import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const token = process.env.TELEGRAM_BOT_TOKEN || '8593766122:AAHoPpGqQUXkmzrcWJ4xf4_5nkVDKR8iDZg';
const webAppUrl = process.env.WEB_APP_URL || 'https://ai-trust-game-production.up.railway.app';

let BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || '';

const CHANNEL_FILE = path.join(__dirname, 'channel.json');
function getChannelId() {
  try {
    const d = JSON.parse(fs.readFileSync(CHANNEL_FILE, 'utf8'));
    return d.channelId;
  } catch { return process.env.CHANNEL_ID || null; }
}
function setChannelId(id) {
  fs.writeFileSync(CHANNEL_FILE, JSON.stringify({ channelId: String(id) }));
}

const bot = new TelegramBot(token, { polling: true });

function botLink(path = '') {
  return `https://t.me/${BOT_USERNAME || 'Arboo34_bot'}${path}`;
}

// Получаем username при старте, если не задан в env
(async () => {
  if (!BOT_USERNAME) {
    try {
      const me = await bot.getMe();
      BOT_USERNAME = me.username || '';
      if (BOT_USERNAME) console.log('📱 Bot username:', BOT_USERNAME);
    } catch (e) {
      console.warn('[bot] Could not fetch username:', e.message);
    }
  }
  bot.setMyDescription({ description: 'Угадай, фото или AI? Игра с подсказками, пропуском и страховкой серии. Premium от 2 Stars.' }).catch(() => {});
  bot.setMyShortDescription({ short_description: 'Фото или нейросеть? Premium подсказки.' }).catch(() => {});
  bot.setMyCommands([
    { command: 'start', description: 'Начать игру' },
    { command: 'premium', description: 'Подсказки, пропуск, страховка' },
    { command: 'share', description: 'Поделиться результатом' },
  ]).catch(() => {});
})();

bot.on('inline_query', (query) => {
  const results = [
    {
      type: 'article',
      id: '1',
      title: '🎮 Играть — AI Trust',
      description: 'Угадай, фото или нейросеть',
      input_message_content: { message_text: `🎮 Игра «Нейросеть или реальность?»\n${botLink()}` },
    },
    {
      type: 'article',
      id: '2',
      title: '💡 Premium от 1 Star',
      description: 'Подсказки, пропуск, страховка',
      input_message_content: { message_text: `💡 AI Trust — Premium от 1 Star\n${botLink()}` },
    },
  ];
  bot.answerInlineQuery(query.id, results, { cache_time: 300 }).catch(() => {});
});

console.log('🤖 Бот запущен!');

// Команда /start
bot.onText(/\/start(.+)?/, (msg, match) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'Игрок';
  const startParam = match?.[1]?.trim();
  const gameUrl = startParam ? `${webAppUrl}${webAppUrl.includes('?') ? '&' : '?'}tg_start=${encodeURIComponent(startParam)}` : webAppUrl;

  const welcomeMessage = `👋 Привет, ${firstName}!

🎮 Игра «Нейросеть или реальность?» — угадай фото или AI
💡 /premium — подсказки для игры
📋 /share — поделиться результатом`;

  bot.sendMessage(chatId, welcomeMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🎮 Играть', web_app: { url: gameUrl } }],
        [{ text: '💡 Подсказки', callback_data: 'hints_5' }],
        [{ text: '➕ Добавить в группу', url: botLink('?startgroup') }],
      ]
    }
  });
});

// Команда /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `📖 AI Trust Experiment

🎮 Игра — угадай, фото или AI
💡 /premium — подсказки (5 шт за 5 Stars)
📋 /share — поделиться результатом`;

  bot.sendMessage(chatId, helpMessage, {
    reply_markup: {
      inline_keyboard: [[
        {
          text: '🎮 Играть',
          web_app: { url: webAppUrl }
        }
      ]]
    }
  });
});

// Stars: pre-checkout — подтверждаем донат
bot.on('pre_checkout_query', async (query) => {
  try {
    await bot.answerPreCheckoutQuery(query.id, true);
    console.log('[Stars] Pre-checkout OK:', query.id);
  } catch (err) {
    console.error('[Stars] Pre-checkout error:', err);
    await bot.answerPreCheckoutQuery(query.id, false, { error_message: 'Ошибка обработки' });
  }
});

const SERVER_URL = process.env.SERVER_URL || process.env.API_BASE || 'http://localhost:3000';
const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'change-me-in-production';
async function addCredits(userId, type, count, extra) {
  let path = type === 'hints' ? '/api/hints/add' : type === 'skip' ? '/api/skips/add' : type === 'streak_save' ? '/api/streak-saves/add' : null;
  let body = { userId, count };
  if (type === 'unlimited_hints') {
    path = '/api/hints/unlimited-add';
    body = { userId, hours: extra || 24 };
  }
  if (!path) return false;
  try {
    const r = await fetch(`${SERVER_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': INTERNAL_SECRET },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    return true;
  } catch (e) {
    console.error(`[${type}] addCredits failed:`, e);
    return false;
  }
}

// Stars: успешная оплата
bot.on('message', async (msg) => {
  if (!msg.successful_payment) return;
  const p = msg.successful_payment;
  let payload = {};
  try {
    payload = JSON.parse(p.invoice_payload || '{}');
  } catch {}
  console.log('[Stars] Payment:', p.telegram_payment_charge_id, 'amount:', p.total_amount, 'payload:', payload);
  const uid = msg.from?.id;
  if (!uid) return;
  if (payload.type === 'hints_pack') {
    const count = payload.count || 5;
    if (await addCredits(uid, 'hints', count)) await bot.sendMessage(msg.chat.id, `✅ +${count} подсказок!`);
  } else if (payload.type === 'skip') {
    if (await addCredits(uid, 'skip', 1)) await bot.sendMessage(msg.chat.id, '✅ +1 пропуск!');
  } else if (payload.type === 'streak_save') {
    const count = payload.count || 1;
    if (await addCredits(uid, 'streak_save', count)) await bot.sendMessage(msg.chat.id, `✅ +${count} страховок серии!`);
  } else if (payload.type === 'tip') {
    await bot.sendMessage(msg.chat.id, '🙏 Спасибо за поддержку!');
  } else if (payload.type === 'unlimited_hints') {
    const hours = payload.hours || 24;
    if (await addCredits(uid, 'unlimited_hints', 1, hours)) await bot.sendMessage(msg.chat.id, `✅ Безлимит подсказок на ${hours}ч!`);
  }
});

// Команда /premium — купить подсказки
bot.onText(/\/(premium|hints|donate)/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '💡 Premium — больше очков:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '1 подсказка (1 ⭐)', callback_data: 'hints_1' }, { text: '3 подсказки (3 ⭐)', callback_data: 'hints_3' }, { text: '5 подсказок (5 ⭐)', callback_data: 'hints_5' }],
        [{ text: '10 подсказок (8 ⭐)', callback_data: 'hints_10' }, { text: '20 подсказок (15 ⭐)', callback_data: 'hints_20' }],
        [{ text: 'Безлимит 24ч (15 ⭐)', callback_data: 'buy_unlimited' }],
        [{ text: 'Пропуск (2 ⭐)', callback_data: 'buy_skip' }, { text: 'Страховка (3 ⭐)', callback_data: 'buy_streak' }, { text: '3 страховки (7 ⭐)', callback_data: 'buy_streak_3' }],
        [{ text: '🙏 Поддержать (1 ⭐)', callback_data: 'buy_tip' }],
        [{ text: '🎮 Играть', web_app: { url: webAppUrl } }],
      ],
    },
  });
});
bot.on('callback_query', async (q) => {
  const d = q.data;
  try {
    if (d?.startsWith('hints_')) {
      const pack = Math.min(parseInt(d.replace('hints_', ''), 20) || 5, 20);
      const amounts = { 1: 1, 3: 3, 5: 5, 10: 8, 20: 15 };
      const amt = amounts[pack] ?? pack;
      await bot.sendInvoice(q.message.chat.id, `${pack} подсказок — AI Trust`, `${pack} подсказок за ${amt} Stars.`, JSON.stringify({ type: 'hints_pack', count: pack }), '', 'XTR', [{ label: `${pack} подсказок`, amount: amt }]);
    } else if (d === 'buy_tip') {
      await bot.sendInvoice(q.message.chat.id, 'Поддержка — AI Trust', 'Спасибо! Stars выводятся в TON.', JSON.stringify({ type: 'tip', count: 1 }), '', 'XTR', [{ label: '1 Star', amount: 1 }]);
    } else if (d === 'buy_unlimited') {
      await bot.sendInvoice(q.message.chat.id, 'Безлимит подсказок 24ч — AI Trust', 'Неограниченные подсказки на 24 часа.', JSON.stringify({ type: 'unlimited_hints', hours: 24 }), '', 'XTR', [{ label: '24 часа', amount: 15 }]);
    } else if (d === 'buy_streak_3') {
      await bot.sendInvoice(q.message.chat.id, '3 страховки — AI Trust', 'Выгодный пакет. 3 страховки за 7 Stars.', JSON.stringify({ type: 'streak_save', count: 3 }), '', 'XTR', [{ label: '3 страховки', amount: 7 }]);
    } else if (d === 'buy_skip') {
      await bot.sendInvoice(q.message.chat.id, '1 пропуск — AI Trust', 'Пропусти сложный вопрос.', JSON.stringify({ type: 'skip', count: 1 }), '', 'XTR', [{ label: '1 пропуск', amount: 2 }]);
    } else if (d === 'buy_streak') {
      await bot.sendInvoice(q.message.chat.id, '1 страховка серии — AI Trust', 'Сохрани серию при ошибке.', JSON.stringify({ type: 'streak_save', count: 1 }), '', 'XTR', [{ label: '1 страховка', amount: 3 }]);
    } else return;
    await bot.answerCallbackQuery(q.id);
  } catch (err) {
    console.error('[invoice]', err);
    await bot.answerCallbackQuery(q.id, { text: 'Ошибка' });
  }
});

// Бот добавлен в группу или канал
bot.on('my_chat_member', (msg) => {
  const chat = msg.chat;
  const newStatus = msg.new_chat_member?.status;
  const botUser = msg.new_chat_member?.user;
  if (!botUser?.is_bot || (newStatus !== 'member' && newStatus !== 'administrator')) return;

  // Канал — авто-сохраняем для постинга (без /setchannel)
  if (chat.type === 'channel') {
    setChannelId(chat.id);
    console.log('[autopost] Channel saved:', chat.id);
  }

  const text = `Спасибо за добавление!

🎮 AI Trust — угадай, фото или AI
💡 /premium — подсказки для игры

${botLink()}`;
  bot.sendMessage(chat.id, text).catch(() => {});
});

// /share — готовые посты для копирования
bot.onText(/\/share/, (msg) => {
  const chatId = msg.chat.id;
  const shareText = `Я набрал X очков в «Нейросеть или реальность?» — попробуй! ${botLink()}`;
  bot.sendMessage(chatId, `📋 Поделиться результатом:\n\n<code>${shareText}</code>\n\nЗамени X на свой счёт.`, { parse_mode: 'HTML' });
});

// /links — ссылки
bot.onText(/\/links/, (msg) => {
  bot.sendMessage(msg.chat.id, `🔗 ${botLink()}`);
});

// /setchannel — сохранить канал для авто-постинга (отправить в канале, где бот админ)
bot.onText(/\/setchannel/, (msg) => {
  const chat = msg.chat;
  if (chat.type !== 'channel' && chat.type !== 'supergroup') {
    bot.sendMessage(msg.chat.id, 'Отправьте /setchannel в канале, где бот — администратор.');
    return;
  }
  setChannelId(chat.id);
  bot.sendMessage(msg.chat.id, 'Канал сохранён. Авто-пост каждые 6 часов.');
});

// Авто-пост в канал каждые 6 часов (запускается при добавлении бота в канал)
function getChannelPost() {
  return `🎮 AI Trust — фото или нейросеть?
💡 От 1 ⭐ — подсказки, пропуск, страховка

${botLink()}`;
}

function postToChannel() {
  const ch = getChannelId();
  if (!ch) return;
  bot.sendMessage(ch, getChannelPost()).catch((e) => console.error('[autopost]', e));
}
// Интервал всегда запущен — постит только если канал сохранён
setInterval(postToChannel, 4 * 60 * 60 * 1000);
const ch0 = getChannelId();
if (ch0) {
  postToChannel();
  console.log('[autopost] Channel:', ch0, 'every 6h');
}

// Обработка ошибок
bot.on('polling_error', (error) => {
  console.error('❌ Ошибка polling:', error);
});

bot.on('error', (error) => {
  console.error('❌ Ошибка бота:', error);
});

// Информация о боте при запуске
console.log('✅ Бот готов к работе!');
console.log(`📱 Web App URL: ${webAppUrl}`);
console.log('💡 Убедитесь, что Web App URL настроен правильно в BotFather!');





