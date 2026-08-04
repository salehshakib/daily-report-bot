const TelegramBot = require('node-telegram-bot-api');
const { handleUpdate } = require('../lib/bot-handlers');

let bot;

function getBot() {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('Missing TELEGRAM_BOT_TOKEN');
    }
    bot = new TelegramBot(token, { webHook: false, polling: false });
  }
  return bot;
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true, message: 'Telegram webhook. Use POST.' });
    return;
  }

  // Always ack Telegram quickly so it does not disable the webhook on handler errors
  try {
    const tgBot = getBot();
    await handleUpdate(tgBot, parseBody(req));
  } catch (err) {
    console.error('webhook error:', err);
    try {
      const update = parseBody(req);
      const chatId = update?.message?.chat?.id;
      if (chatId) {
        await getBot().sendMessage(chatId, `Error: ${err.message}`);
      }
    } catch (notifyErr) {
      console.error('failed to notify chat:', notifyErr.message);
    }
  }

  res.status(200).json({ ok: true });
};
