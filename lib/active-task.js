const axios = require('axios');
const { getAuth } = require('./report');
const { isTokenValid, getTokenExp } = require('./jwt');
const { patchSession } = require('../sessions');

const {
  PM_API_URL = 'https://api.pmv3.taghyeer.ai/api/v1',
} = process.env;

function apiBase() {
  return PM_API_URL.replace(/\/$/, '');
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function isTaskTimerRunning(task) {
  if (!task || typeof task !== 'object') return false;
  const worktime = Array.isArray(task.worktime) ? task.worktime : [];
  return worktime.some(w => w && (w.endTime === null || w.endTime === undefined));
}

function getOpenWorktime(task) {
  const worktime = Array.isArray(task?.worktime) ? task.worktime : [];
  return worktime.find(w => w && (w.endTime === null || w.endTime === undefined)) || null;
}

function segmentMs(entry, now = Date.now()) {
  if (!entry?.startTime) return 0;
  const start = new Date(entry.startTime).getTime();
  if (Number.isNaN(start)) return 0;
  const end = entry.endTime ? new Date(entry.endTime).getTime() : now;
  if (Number.isNaN(end) || end < start) return 0;
  return end - start;
}

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes || hours) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

function getRunningDurationMs(task, now = Date.now()) {
  const open = getOpenWorktime(task);
  return open ? segmentMs(open, now) : 0;
}

function getTotalWorkedMs(task, now = Date.now()) {
  const worktime = Array.isArray(task?.worktime) ? task.worktime : [];
  return worktime.reduce((sum, entry) => sum + segmentMs(entry, now), 0);
}

async function fetchActiveTask(token) {
  const res = await axios.get(`${apiBase()}/dashboard/me/active-task`, {
    headers: authHeaders(token),
  });
  const task = res.data?.data;
  return task && typeof task === 'object' ? task : null;
}

async function pauseTask(token, taskId) {
  const res = await axios.post(
    `${apiBase()}/tasks/${taskId}/pause`,
    {},
    { headers: authHeaders(token) }
  );
  return res.data;
}

async function completeTask(token, taskId) {
  const res = await axios.post(
    `${apiBase()}/tasks/${taskId}/complete`,
    {},
    { headers: authHeaders(token) }
  );
  return res.data;
}

function sessionTokenFields(auth) {
  return {
    token: auth.token,
    tokenExp: getTokenExp(auth.token),
  };
}

/**
 * Prefer a non-expired stored JWT. For interactive commands, refresh via password if expired.
 * Cron should call with { refresh: false }.
 */
async function resolveAccessToken(session, { refresh = true, telegramUserId } = {}) {
  if (session?.token && isTokenValid(session.token)) {
    return session.token;
  }

  if (!refresh) return null;

  if (!session?.email || !session?.password) return null;

  const auth = await getAuth(session.email, session.password);
  if (telegramUserId) {
    await patchSession(telegramUserId, {
      ...sessionTokenFields(auth),
      name: auth.name || session.name,
      email: auth.email || session.email,
    });
  }
  return auth.token;
}

function formatActiveTaskAlert(task) {
  const number = task.taskNumber || task._id;
  const title = task.title || 'Untitled';
  const status = task.status || 'Unknown';
  const lines = [
    'You still have an active task running after 6:30 PM:',
    '',
    `#${number}: ${title}`,
    `Status: ${status}`,
  ];
  if (isTaskTimerRunning(task)) {
    lines.push(`Running for: ${formatDuration(getRunningDurationMs(task))}`);
  }
  lines.push('', 'Use /pause or /complete.');
  return lines.join('\n');
}

function formatActiveTaskStatus(task) {
  const number = task.taskNumber || task._id;
  const title = task.title || 'Untitled';
  const status = task.status || 'Unknown';
  const lines = [
    'Active task:',
    `#${number}: ${title}`,
    `Status: ${status}`,
  ];

  if (isTaskTimerRunning(task)) {
    lines.push(`Timer: Running`);
    lines.push(`Running for: ${formatDuration(getRunningDurationMs(task))}`);
  } else {
    lines.push('Timer: Not running');
  }

  lines.push(`Total worked: ${formatDuration(getTotalWorkedMs(task))}`);

  if (task.ticket?.ticketNumber) {
    lines.push(`Ticket: ${task.ticket.ticketNumber}`);
  }
  return lines.join('\n');
}

module.exports = {
  fetchActiveTask,
  pauseTask,
  completeTask,
  resolveAccessToken,
  sessionTokenFields,
  formatActiveTaskAlert,
  formatActiveTaskStatus,
};
