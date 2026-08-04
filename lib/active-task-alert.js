const TelegramBot = require('node-telegram-bot-api');
const { listLoggedInSessions, patchSession } = require('../sessions');
const {
  fetchActiveTask,
  withUserAuth,
  formatActiveTaskAlert,
} = require('./active-task');
const { getTodayDhaka } = require('./report');

function getBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN');
  return new TelegramBot(token, { webHook: false, polling: false });
}

async function notifyUserIfActive(bot, session, today) {
  const telegramUserId = session.telegramUserId;
  const chatId = session.chatId || telegramUserId;

  if (!session.email || !session.password) {
    return { telegramUserId, skipped: true, reason: 'no-credentials' };
  }

  if (session.activeTaskAlertDate === today) {
    return { telegramUserId, skipped: true, reason: 'already-notified' };
  }

  try {
    const task = await withUserAuth(session.email, session.password, auth =>
      fetchActiveTask(auth.token)
    );

    if (!task) {
      return { telegramUserId, skipped: true, reason: 'no-active-task' };
    }

    await bot.sendMessage(chatId, formatActiveTaskAlert(task));
    await patchSession(telegramUserId, { activeTaskAlertDate: today });
    return { telegramUserId, notified: true, taskNumber: task.taskNumber };
  } catch (err) {
    console.error(`active-task alert failed for ${telegramUserId}:`, err.message);
    return {
      telegramUserId,
      error: err.response?.data?.message || err.message,
    };
  }
}

async function runActiveTaskAlerts() {
  const today = getTodayDhaka();
  const bot = getBot();
  const sessions = await listLoggedInSessions();
  const results = [];

  for (const session of sessions) {
    results.push(await notifyUserIfActive(bot, session, today));
  }

  return {
    date: today,
    checked: sessions.length,
    notified: results.filter(r => r.notified).length,
    results,
  };
}

module.exports = {
  runActiveTaskAlerts,
  notifyUserIfActive,
};
