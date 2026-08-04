const TelegramBot = require('node-telegram-bot-api');
const { listLoggedInSessions, patchSession } = require('../sessions');
const {
  fetchActiveTask,
  resolveAccessToken,
  formatActiveTaskAlert,
} = require('./active-task');
const { isTokenValid } = require('./jwt');
const { getTodayDhaka, isWithinActiveTaskAlertWindow } = require('./report');

/** Don't re-send within the same ~1 hour slot (cron may retry). */
const ALERT_COOLDOWN_MS = 55 * 60 * 1000;

function getBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN');
  return new TelegramBot(token, { webHook: false, polling: false });
}

async function markActiveTaskResolved(telegramUserId, today = getTodayDhaka()) {
  await patchSession(telegramUserId, {
    activeTaskResolvedDate: today,
  });
}

async function notifyUserIfActive(bot, session, today) {
  const telegramUserId = session.telegramUserId;
  const chatId = session.chatId || telegramUserId;

  if (!isWithinActiveTaskAlertWindow()) {
    return { telegramUserId, skipped: true, reason: 'before-1830' };
  }

  if (session.activeTaskResolvedDate === today) {
    return { telegramUserId, skipped: true, reason: 'already-resolved' };
  }

  if (session.lastActiveTaskAlertAt) {
    const last = Date.parse(session.lastActiveTaskAlertAt);
    if (!Number.isNaN(last) && Date.now() - last < ALERT_COOLDOWN_MS) {
      return { telegramUserId, skipped: true, reason: 'cooldown' };
    }
  }

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
      // No active task (paused/completed elsewhere) — stop checking for today
      await markActiveTaskResolved(telegramUserId, today);
      return { telegramUserId, skipped: true, reason: 'no-active-task-resolved' };
    }

    await bot.sendMessage(chatId, formatActiveTaskAlert(task));
    await patchSession(telegramUserId, {
      lastActiveTaskAlertAt: new Date().toISOString(),
      // clear legacy once-per-day flag if present
      activeTaskAlertDate: null,
    });
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
    windowOpen: isWithinActiveTaskAlertWindow(),
    checked: sessions.length,
    notified: results.filter(r => r.notified).length,
    results,
  };
}

module.exports = {
  runActiveTaskAlerts,
  markActiveTaskResolved,
};
