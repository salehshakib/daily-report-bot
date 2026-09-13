const axios = require("axios");
const { apiBase } = require("./env");

const TASK_STATUSES = ["todo", "in-progress", "completed"];
const TASK_PAGE_SIZE = 100;
/** Safety stop so a server that ignores `page` cannot loop forever. */
const MAX_TASK_PAGES = 20;

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

async function fetchTaskList(token, status, filter) {
  const encoded = encodeURIComponent(JSON.stringify(filter));
  const all = [];
  // Paged: an all-users week range easily passes 100 tasks per status.
  for (let page = 1; page <= MAX_TASK_PAGES; page++) {
    const url = `${apiBase()}/tasks/${status}?length=${TASK_PAGE_SIZE}&page=${page}&filter=${encoded}`;
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const batch = Array.isArray(res.data?.data) ? res.data.data : [];
    all.push(...batch);
    if (batch.length < TASK_PAGE_SIZE) break;
  }
  return all;
}

/** Fetch all three statuses for one filter and de-duplicate by task id. */
async function fetchAllStatuses(token, filter) {
  const batches = await Promise.all(
    TASK_STATUSES.map((status) => fetchTaskList(token, status, filter)),
  );
  const byId = new Map();
  for (const task of batches.flat()) {
    if (task?._id && !byId.has(task._id)) byId.set(task._id, task);
  }
  return [...byId.values()];
}

function assigneeDayFilter(assigneeId, dateStr) {
  return {
    and: {
      "assignee._id": assigneeId,
      dueDate__dateRange: [dateStr, dateStr],
    },
  };
}

function assigneeRangeFilter(assigneeId, fromStr, toStr) {
  return {
    and: {
      "assignee._id": assigneeId,
      dueDate__dateRange: [fromStr, toStr],
    },
  };
}

/** Due-date only (all assignees) — used by the *_all commands. */
function rangeFilter(fromStr, toStr) {
  return {
    and: {
      dueDate__dateRange: [fromStr, toStr],
    },
  };
}

function fetchDayTasks(token, assigneeId, dateStr) {
  return fetchAllStatuses(token, assigneeDayFilter(assigneeId, dateStr));
}

function fetchRangeTasks(token, assigneeId, fromStr, toStr) {
  return fetchAllStatuses(token, assigneeRangeFilter(assigneeId, fromStr, toStr));
}

/** All assignees' tasks due on dateStr. */
function fetchAllDayTasksByDueDate(token, dateStr) {
  return fetchAllStatuses(token, rangeFilter(dateStr, dateStr));
}

/** All assignees' tasks due between fromStr and toStr. */
function fetchAllRangeTasks(token, fromStr, toStr) {
  return fetchAllStatuses(token, rangeFilter(fromStr, toStr));
}

module.exports = {
  TASK_STATUSES,
  TASK_PAGE_SIZE,
  getAuth,
  fetchDayTasks,
  fetchRangeTasks,
  fetchAllDayTasksByDueDate,
  fetchAllRangeTasks,
};
