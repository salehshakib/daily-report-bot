const axios = require("axios");

const TASK_STATUSES = ["todo", "in-progress", "completed"];
const TASK_PAGE_SIZE = 100;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in environment`);
  return value;
}

function apiBase() {
  return requireEnv("PM_API_URL").replace(/\/$/, "");
}

function timezone() {
  return requireEnv("TIMEZONE");
}

function formatDateInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getTodayDhaka() {
  return formatDateInTimeZone(new Date(), timezone());
}

/** Minutes since local midnight in TIMEZONE. */
function getMinutesSinceMidnightDhaka(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone(),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

/** Active-task reminders start at 18:30 in TIMEZONE. */
function isWithinActiveTaskAlertWindow(date = new Date()) {
  return getMinutesSinceMidnightDhaka(date) >= 18 * 60 + 30;
}

function addDaysToDateStr(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  utc.setUTCDate(utc.getUTCDate() + days);
  return formatDateInTimeZone(utc, timezone());
}

function weekdayInTimeZone(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone(),
    weekday: "short",
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
      "assignee._id": assigneeId,
      dueDate__dateRange: [dateStr, dateStr],
    },
  };
}

async function getAuth(email, password) {
  const res = await axios.post(`${apiBase()}/login`, { email, password });
  const payload = res.data?.data;
  if (!payload?.token) {
    throw new Error(res.data?.message || "Login failed");
  }
  return {
    token: payload.token,
    name: payload.user?.name || "Unknown",
    assigneeId: payload.user?._id,
    email: payload.user?.email || email,
  };
}

async function fetchTasks(token, assigneeId, status, dateStr) {
  const filter = encodeURIComponent(
    JSON.stringify(buildFilter(assigneeId, dateStr)),
  );
  const url = `${apiBase()}/tasks/${status}?length=${TASK_PAGE_SIZE}&page=1&filter=${filter}`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Array.isArray(res.data?.data) ? res.data.data : [];
}

/** In-progress tasks for assignee (any due date) — catches worktime not due today. */
async function fetchAssigneeInProgress(token, assigneeId) {
  const filter = encodeURIComponent(
    JSON.stringify({ and: { "assignee._id": assigneeId } }),
  );
  const url = `${apiBase()}/tasks/in-progress?length=${TASK_PAGE_SIZE}&page=1&filter=${filter}`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Array.isArray(res.data?.data) ? res.data.data : [];
}

async function fetchDayTasks(token, assigneeId, dateStr) {
  const batches = await Promise.all(
    TASK_STATUSES.map((status) =>
      fetchTasks(token, assigneeId, status, dateStr),
    ),
  );
  const byId = new Map();
  for (const task of batches.flat()) {
    if (task?._id && !byId.has(task._id)) {
      byId.set(task._id, task);
    }
  }
  return [...byId.values()];
}

/** Today tasks: due today (todo/in-progress/completed) + any in-progress with worktime. */
async function fetchDailyReportTasks(token, assigneeId, dateStr) {
  const [dueToday, inProgressAny] = await Promise.all([
    fetchDayTasks(token, assigneeId, dateStr),
    fetchAssigneeInProgress(token, assigneeId),
  ]);

  const byId = new Map();
  for (const task of dueToday) {
    if (task?._id) byId.set(task._id, task);
  }
  for (const task of inProgressAny) {
    if (!task?._id) continue;
    if (byId.has(task._id)) continue;
    // Include if there is worktime on this date (or timer still running)
    const worked = taskWorkedMsOnDate(task, dateStr);
    const running = Array.isArray(task.worktime)
      ? task.worktime.some(
          (w) => w && (w.endTime === null || w.endTime === undefined),
        )
      : false;
    if (worked > 0 || running) byId.set(task._id, task);
  }
  return [...byId.values()];
}

function formatTaskLines(tasks) {
  if (!tasks.length) return "N/A";
  return tasks.map((t) => `#${t.taskNumber}: ${t.title}`).join("\n");
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
  return titles.length ? titles.join(", ") : "N/A";
}

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (!hours && !minutes) return "0m";
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes || !hours) parts.push(`${minutes}m`);
  return parts.join(" ");
}

/** UTC ms for YYYY-MM-DD 00:00 in TIMEZONE. */
function zonedMidnightUtc(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcNoon = Date.UTC(y, m - 1, d, 12, 0, 0);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone(),
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(utcNoon));
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "GMT";
  const match = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  let offsetMin = 0;
  if (match) {
    const sign = match[1] === "-" ? -1 : 1;
    offsetMin = sign * (Number(match[2]) * 60 + Number(match[3] || 0));
  }
  return Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMin * 60 * 1000;
}

function segmentMsOnDate(entry, dateStr, now = Date.now()) {
  if (!entry?.startTime) return 0;
  const start = new Date(entry.startTime).getTime();
  const end = entry.endTime ? new Date(entry.endTime).getTime() : now;
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;

  const dayStart = zonedMidnightUtc(dateStr);
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const clippedStart = Math.max(start, dayStart);
  const clippedEnd = Math.min(end, dayEnd);
  return Math.max(0, clippedEnd - clippedStart);
}

function taskWorkedMsOnDate(task, dateStr, now = Date.now()) {
  const worktime = Array.isArray(task?.worktime) ? task.worktime : [];
  return worktime.reduce(
    (sum, entry) => sum + segmentMsOnDate(entry, dateStr, now),
    0,
  );
}

function normalizeTaskStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("progress")) return "in-progress";
  if (s.includes("complete")) return "completed";
  return "todo";
}

function groupTasksByStatus(tasks) {
  const groups = { todo: [], "in-progress": [], completed: [] };
  for (const task of tasks) {
    const key = normalizeTaskStatus(task.status);
    groups[key].push(task);
  }
  return groups;
}

function formatTaskLineWithWorktime(task, dateStr) {
  const base = `#${task.taskNumber}: ${task.title}`;
  const worked = taskWorkedMsOnDate(task, dateStr);
  if (!worked) return base;
  return `${base} — ${formatDuration(worked)}`;
}

function formatStatusSection(label, tasks, dateStr) {
  if (!tasks.length) return `${label}: n/a`;
  return `${label}:\n${tasks.map((t) => formatTaskLineWithWorktime(t, dateStr)).join("\n")}`;
}

/**
 * Daily report for one user: Todo / In Progress / Completed + worktime that day.
 */
function formatUserDailyReportBlock(name, tasks, dateStr) {
  const header = `${name}\n-----------------------`;

  if (!tasks.length) {
    return [
      header,
      "TODO: N/A",
      "",
      "IN-PROGRESS: N/A",
      "",
      "COMPLETED: N/A",
    ].join("\n");
  }

  const groups = groupTasksByStatus(tasks);

  return [
    header,
    formatStatusSection("todo", groups.todo, dateStr),
    "",
    formatStatusSection("inprogress", groups["in-progress"], dateStr),
    "",
    formatStatusSection("completed", groups.completed, dateStr),
  ].join("\n");
}

function buildMessage({ date, name, todayTasks, tomorrowTasks }) {
  const projects = formatProjectLines(todayTasks);
  const todayBlock = formatTaskLines(todayTasks);
  const nextDayBlock = formatTaskLines(tomorrowTasks);

  const todaySection =
    todayBlock === "N/A" ? "Today: N/A" : `Today:\n${todayBlock}`;
  const nextDaySection =
    nextDayBlock === "N/A" ? "Next day: N/A" : `Next day:\n${nextDayBlock}`;

  return (
    [
      `Date: ${date}`,
      `Name: ${name}`,
      `Projects: ${projects}`,
      "",
      todaySection,
      "",
      nextDaySection,
    ]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}

async function runPipeline({ email, password }) {
  const { token, name, assigneeId } = await getAuth(email, password);
  if (!assigneeId) {
    throw new Error("Login ok but user id missing from response");
  }

  const today = getTodayDhaka();
  const nextWorking = getNextWorkingDay(today);

  const [todayTasks, tomorrowTasks] = await Promise.all([
    fetchDayTasks(token, assigneeId, today),
    fetchDayTasks(token, assigneeId, nextWorking),
  ]);

  return buildMessage({ date: today, name, todayTasks, tomorrowTasks });
}

async function resolveUserAuth(session) {
  if (session?.email && session?.password) {
    return getAuth(session.email, session.password);
  }

  const { isTokenValid, decodeJwtPayload } = require("./jwt");
  if (session?.token && isTokenValid(session.token)) {
    const payload = decodeJwtPayload(session.token);
    const assigneeId = payload?.sub;
    if (!assigneeId) return null;
    return {
      token: session.token,
      name: session.name || payload.email || "Unknown",
      assigneeId,
      email: session.email || payload.email,
    };
  }

  return null;
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const idx = next;
      next += 1;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Build a combined report for every logged-in bot user.
 * @param {Array} sessions
 * @param {'today'|'next'} which
 */
async function runAllUsersDayReport(sessions, which) {
  const today = getTodayDhaka();
  const date = which === "next" ? getNextWorkingDay(today) : today;
  const title =
    which === "next" ? "Next day tasks (all)" : "Daily report (all)";

  const seenEmails = new Set();
  const uniqueSessions = [];

  for (const session of sessions) {
    const emailKey = (session.email || "").toLowerCase();
    if (emailKey) {
      if (seenEmails.has(emailKey)) continue;
      seenEmails.add(emailKey);
    }
    uniqueSessions.push(session);
  }

  const blocks = await mapPool(uniqueSessions, 5, async (session) => {
    const label =
      session.name || session.email || `user ${session.telegramUserId}`;
    try {
      const auth = await resolveUserAuth(session);
      if (!auth?.token || !auth?.assigneeId) {
        return `${label}:\nN/A`;
      }

      const tasks =
        which === "today"
          ? await fetchDailyReportTasks(auth.token, auth.assigneeId, date)
          : await fetchDayTasks(auth.token, auth.assigneeId, date);
      const name = auth.name || label;

      if (which === "today") {
        return formatUserDailyReportBlock(name, tasks, date);
      }
      return `${name}:\n${formatTaskLines(tasks)}`;
    } catch (err) {
      console.error(`all-users report failed for ${label}:`, err.message);
      return `${label}:\nN/A`;
    }
  });

  if (!blocks.length) {
    return [`Date: ${date}`, title, "", "N/A"].join("\n") + "\n";
  }

  return [`Date: ${date}`, title, "", blocks.join("\n\n")].join("\n") + "\n";
}

module.exports = {
  getAuth,
  runPipeline,
  runAllUsersDayReport,
  resolveUserAuth,
  getTodayDhaka,
  getNextWorkingDay,
  isWithinActiveTaskAlertWindow,
  apiBase,
};
