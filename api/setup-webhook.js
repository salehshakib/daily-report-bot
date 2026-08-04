const TelegramBot = require('node-telegram-bot-api');
const { BOT_COMMANDS } = require('../lib/bot-handlers');

/**
 * One-time setup after deploy:
 * GET https://YOUR_APP.vercel.app/api/setup-webhook
 */
module.exports = async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    res.status(500).json({ ok: false, error: 'Missing TELEGRAM_BOT_TOKEN' });
    return;
  }

  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    req.headers.host;

  if (!host) {
    res.status(500).json({ ok: false, error: 'Could not determine host URL' });
    return;
  }

  const base = host.startsWith('http') ? host : `https://${host}`;
  const webhookUrl = `${base.replace(/\/$/, '')}/api/webhook`;

  try {
    const bot = new TelegramBot(token, { polling: false, webHook: false });
    await bot.setWebHook(webhookUrl);
    await bot.setMyCommands(BOT_COMMANDS);
    const info = await bot.getWebHookInfo();
    res.status(200).json({
      ok: true,
      webhookUrl,
      info,
      tip: 'Open your bot in Telegram and send /start',
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
