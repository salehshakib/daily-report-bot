const TelegramBot = require('node-telegram-bot-api');
const { registerBotHandlers } = require('../lib/bot-handlers');

let bot;

function getBot() {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('Missing TELEGRAM_BOT_TOKEN');
    }
    // Webhook mode — no polling on Vercel
    bot = new TelegramBot(token, { webHook: false, polling: false });
    registerBotHandlers(bot);
  }
  return bot;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true, message: 'Telegram webhook. Use POST.' });
    return;
  }

  try {
    const tgBot = getBot();
    tgBot.processUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
