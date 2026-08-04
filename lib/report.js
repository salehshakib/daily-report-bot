const axios = require('axios');

const {
  PM_API_URL = 'https://api.pmv3.taghyeer.ai/api/v1',
  TIMEZONE = 'Asia/Dhaka',
} = process.env;

const TASK_STATUSES = ['todo', 'in-progress', 'completed'];

function apiBase() {
  return PM_API_URL.replace(/\/$/, '');
}

function formatDateInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getTodayDhaka() {
  return formatDateInTimeZone(new Date(), TIMEZONE);
}

function addDaysToDateStr(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  utc.setUTCDate(utc.getUTCDate() + days);
  return formatDateInTimeZone(utc, TIMEZONE);
}

function weekdayInTimeZone(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'short',
  }).format(utc);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[short];
}

function getNextWorkingDay(todayStr) {
  const dow = weekdayInTimeZone(todayStr);
  if (dow === 4) return addDaysToDateStr(todayStr, 3);
  if (dow === 5) return addDaysToDateStr(todayStr, 2);
  if (dow === 6) return addDaysToDateStr(todayStr, 1);
  return addDaysToDateStr(todayStr, 1);
}

function buildFilter(assigneeId, dateStr) {
  return {
    and: {
      'assignee._id': assigneeId,
      dueDate__dateRange: [dateStr, dateStr],
    },
  };
}

async function getAuth(email, password) {
  const res = await axios.post(`${apiBase()}/login`, { email, password });
  const payload = res.data?.data;
  if (!payload?.token) {
    throw new Error(res.data?.message || 'Login failed');
  }
  return {
    token: payload.token,
    name: payload.user?.name || 'Unknown',
    assigneeId: payload.user?._id,
    email: payload.user?.email || email,
  };
}

async function fetchTasks(token, assigneeId, status, dateStr) {
  const filter = encodeURIComponent(JSON.stringify(buildFilter(assigneeId, dateStr)));
  const url = `${apiBase()}/tasks/${status}?length=20&page=1&filter=${filter}`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Array.isArray(res.data?.data) ? res.data.data : [];
}

async function fetchDayTasks(token, assigneeId, dateStr) {
  const batches = await Promise.all(
    TASK_STATUSES.map(status => fetchTasks(token, assigneeId, status, dateStr))
  );
  const byId = new Map();
  for (const task of batches.flat()) {
    if (task?._id && !byId.has(task._id)) {
      byId.set(task._id, task);
    }
  }
  return [...byId.values()];
}

function formatTaskLines(tasks) {
  if (!tasks.length) return 'N/A';
  return tasks.map(t => `#${t.taskNumber}: ${t.title}`).join('\n');
}

function formatProjectLines(tasks) {
  const titles = [];
  const seen = new Set();
  for (const t of tasks) {
    const title = t.project?.title?.trim();
    if (!title || seen.has(title)) continue;
    seen.add(title);
    titles.push(title);
  }
  return titles.length ? titles.join(', ') : 'N/A';
}

function buildMessage({ date, name, todayTasks, tomorrowTasks }) {
  const projects = formatProjectLines(todayTasks);
  const todayBlock = formatTaskLines(todayTasks);
  const nextDayBlock = formatTaskLines(tomorrowTasks);

  const todaySection =
    todayBlock === 'N/A' ? 'Today: N/A' : `Today:\n${todayBlock}`;
  const nextDaySection =
    nextDayBlock === 'N/A' ? 'Next day: N/A' : `Next day:\n${nextDayBlock}`;

  return [
    `Date: ${date}`,
    `Name: ${name}`,
    `Projects: ${projects}`,
    '',
    todaySection,
    '',
    nextDaySection,
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd() + '\n';
}

async function runPipeline({ email, password }) {
  const { token, name, assigneeId } = await getAuth(email, password);
  if (!assigneeId) {
    throw new Error('Login ok but user id missing from response');
  }

  const today = getTodayDhaka();
  const nextWorking = getNextWorkingDay(today);

  const [todayTasks, tomorrowTasks] = await Promise.all([
    fetchDayTasks(token, assigneeId, today),
    fetchDayTasks(token, assigneeId, nextWorking),
  ]);

  return buildMessage({ date: today, name, todayTasks, tomorrowTasks });
}

module.exports = {
  getAuth,
  runPipeline,
  getTodayDhaka,
};
