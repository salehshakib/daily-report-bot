require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { claimSingleInstance } = require('./single-instance');
const { registerBotHandlers, BOT_COMMANDS } = require('./lib/bot-handlers');

claimSingleInstance();

const { TELEGRAM_BOT_TOKEN } = process.env;

async function main() {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN in .env');
  }

  const tgBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
  registerBotHandlers(tgBot);

  console.log('Telegram bot listening (polling). Commands:');
  for (const c of BOT_COMMANDS) {
    console.log(`  /${c.command} — ${c.description}`);
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
