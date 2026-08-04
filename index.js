require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { claimSingleInstance } = require('./single-instance');
const { registerBotHandlers } = require('./lib/bot-handlers');
const { runPipeline } = require('./lib/report');

claimSingleInstance();

const {
  TELEGRAM_BOT_TOKEN,
  WEBSITE_USERNAME,
  WEBSITE_PASSWORD,
} = process.env;

function startTelegramBot() {
  const tgBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
  registerBotHandlers(tgBot);
  console.log('Telegram bot listening (polling). Commands: /start /login /run /logout /whoami');
}

async function main() {
  const enableTelegram =
    Boolean(TELEGRAM_BOT_TOKEN) &&
    (process.argv.includes('--telegram') || process.env.ENABLE_TELEGRAM === 'true');

  if (enableTelegram) {
    startTelegramBot();
    return;
  }

  if (!WEBSITE_USERNAME || !WEBSITE_PASSWORD) {
    throw new Error(
      'Missing WEBSITE_USERNAME / WEBSITE_PASSWORD (or run: npm run telegram)'
    );
  }

  const { message } = await runPipeline({
    email: WEBSITE_USERNAME,
    password: WEBSITE_PASSWORD,
  });
  console.log(message);
}

main().catch(err => {
  console.error(err.response?.data || err.message || err);
  process.exit(1);
});
