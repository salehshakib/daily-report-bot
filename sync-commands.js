/**
 * Push BOT_COMMANDS to Telegram without deploying or starting the bot:
 *   npm run sync-commands
 *
 * Telegram caches the menu per client, so restart the app if it looks stale.
 */
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { BOT_COMMANDS } = require('./lib/constants');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN in .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: false, webHook: false });

bot
  .setMyCommands(BOT_COMMANDS)
  .then(() => bot.getMyCommands())
  .then(commands => {
    console.log('Telegram now has:');
    for (const c of commands) console.log(`  /${c.command} — ${c.description}`);
  })
  .catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
