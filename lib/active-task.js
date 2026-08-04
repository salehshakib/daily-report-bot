const axios = require('axios');
const { getAuth } = require('./report');

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

async function withUserAuth(email, password, fn) {
  const auth = await getAuth(email, password);
  return fn(auth);
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

module.exports = {
  fetchActiveTask,
  pauseTask,
  completeTask,
  withUserAuth,
  isTaskTimerRunning,
  formatActiveTaskAlert,
};
