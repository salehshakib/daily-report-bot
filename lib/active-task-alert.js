const TelegramBot = require('node-telegram-bot-api');
const { listLoggedInSessions, patchSession } = require('../sessions');
const {
  fetchActiveTask,
  resolveAccessToken,
  formatActiveTaskAlert,
} = require('./active-task');
const { isTokenValid } = require('./jwt');
const { getTodayDhaka } = require('./report');

function getBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN');
  return new TelegramBot(token, { webHook: false, polling: false });
}

async function notifyUserIfActive(bot, session, today) {
  const telegramUserId = session.telegramUserId;
  const chatId = session.chatId || telegramUserId;

  if (session.activeTaskAlertDate === today) {
    return { telegramUserId, skipped: true, reason: 'already-notified' };
  }

  // Alert only when stored PM JWT is still valid (read exp from token payload)
  if (!session.token || !isTokenValid(session.token)) {
    return { telegramUserId, skipped: true, reason: 'token-expired' };
  }

  try {
    const accessToken = await resolveAccessToken(session, {
      refresh: false,
      telegramUserId,
    });
    if (!accessToken) {
      return { telegramUserId, skipped: true, reason: 'token-expired' };
    }

    const task = await fetchActiveTask(accessToken);
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
};
