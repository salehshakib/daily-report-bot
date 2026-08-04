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
  return [
    'You still have an active task running after 6:30 PM:',
    '',
    `#${number}: ${title}`,
    `Status: ${status}`,
    '',
    'Use /pause or /complete.',
  ].join('\n');
}

function formatActiveTaskStatus(task) {
  const number = task.taskNumber || task._id;
  const title = task.title || 'Untitled';
  const status = task.status || 'Unknown';
  const running = isTaskTimerRunning(task) ? 'Running' : 'Not running';
  const lines = [
    'Active task:',
    `#${number}: ${title}`,
    `Status: ${status}`,
    `Timer: ${running}`,
  ];
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
