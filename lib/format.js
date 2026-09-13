const { formatDuration, taskWorkedMsOnDate } = require("./worktime");

const DIVIDER = "-------------------------------";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function nameHeader(name) {
  return `<b>${escapeHtml(name)}</b>\n${DIVIDER}`;
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
    groups[normalizeTaskStatus(task.status)].push(task);
  }
  return groups;
}

function groupTasksByAssignee(tasks) {
  const byAssignee = new Map();

  for (const task of tasks) {
    const id = task.assignee?._id || "unknown";
    const name = task.assignee?.name || "Unknown";
    if (!byAssignee.has(id)) byAssignee.set(id, { name, tasks: [] });
    byAssignee.get(id).tasks.push(task);
  }

  return [...byAssignee.values()].sort((a, b) =>
    String(a.name).localeCompare(String(b.name)),
  );
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

function formatTaskLineWithWorktime(task, dateStr) {
  const base = `#${escapeHtml(task.taskNumber || "")}: ${escapeHtml(task.title || "")}`;
  const worked = taskWorkedMsOnDate(task, dateStr);
  return worked ? `${base} — <b>${escapeHtml(formatDuration(worked))}</b>` : base;
}

function formatStatusSection(label, tasks, dateStr) {
  if (!tasks.length) return `${label}: N/A`;
  return `${label}:\n${tasks.map((t) => formatTaskLineWithWorktime(t, dateStr)).join("\n")}`;
}

/**
 * Daily report for one user: Todo / In Progress / Completed + worktime that day.
 * Uses Telegram HTML (<b>) for name and work time.
 */
function formatUserDailyReportBlock(name, tasks, dateStr) {
  const header = nameHeader(name);

  if (!tasks.length) {
    return [
      header,
      "TODO: N/A",
      "",
      "IN-PROGRESS: N/A",
      "",
      "COMPLETED: N/A",
      "",
      "<b>TOTAL WORK TIME: N/A</b>",
    ].join("\n");
  }

  const groups = groupTasksByStatus(tasks);
  const totalWorked = tasks.reduce(
    (sum, task) => sum + taskWorkedMsOnDate(task, dateStr),
    0,
  );
  const totalLabel = totalWorked ? formatDuration(totalWorked) : "N/A";

  return [
    header,
    formatStatusSection("TODO", groups.todo, dateStr),
    "",
    formatStatusSection("IN-PROGRESS", groups["in-progress"], dateStr),
    "",
    formatStatusSection("COMPLETED", groups.completed, dateStr),
    "",
    `<b>TOTAL WORK TIME: ${escapeHtml(totalLabel)}</b>`,
  ].join("\n");
}

/** Plain-text /run message: today + next working day. */
function buildDailyMessage({ date, name, todayTasks, tomorrowTasks }) {
  const todayBlock = formatTaskLines(todayTasks);
  const nextDayBlock = formatTaskLines(tomorrowTasks);

  return (
    [
      `Date: ${date}`,
      `Name: ${name}`,
      `Projects: ${formatProjectLines(todayTasks)}`,
      "",
      todayBlock === "N/A" ? "Today: N/A" : `Today:\n${todayBlock}`,
      "",
      nextDayBlock === "N/A" ? "Next day: N/A" : `Next day:\n${nextDayBlock}`,
    ]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}

module.exports = {
  DIVIDER,
  escapeHtml,
  nameHeader,
  normalizeTaskStatus,
  groupTasksByStatus,
  groupTasksByAssignee,
  formatTaskLines,
  formatProjectLines,
  formatStatusSection,
  formatUserDailyReportBlock,
  buildDailyMessage,
};
