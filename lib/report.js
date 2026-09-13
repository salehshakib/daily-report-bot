/**
 * Report orchestration. Building blocks live in:
 *   env.js       — required env vars + API base
 *   dates.js     — TIMEZONE date maths and yyyy-mm-dd parsing
 *   pm-api.js    — Taghyeer PM HTTP calls
 *   worktime.js  — worktime/estimate maths
 *   format.js    — Telegram message formatting
 */
const { apiBase } = require("./env");
const {
  getTodayDhaka,
  getNextWorkingDay,
  getRecentWeekRanges,
  isWithinActiveTaskAlertWindow,
  parseInputDate,
} = require("./dates");
const {
  getAuth,
  fetchDayTasks,
  fetchRangeTasks,
  fetchAllDayTasksByDueDate,
  fetchAllRangeTasks,
} = require("./pm-api");
const {
  formatDuration,
  taskWorkedMsInRange,
  taskEstimateMs,
} = require("./worktime");
const {
  DIVIDER,
  escapeHtml,
  nameHeader,
  renderTable,
  groupTasksByAssignee,
  formatTaskLines,
  formatUserDailyReportBlock,
  buildDailyMessage,
} = require("./format");

/** /run — one user, a given day (default today) plus the next working day. */
async function runPipeline({ email, password, date }) {
  const { token, name, assigneeId } = await getAuth(email, password);
  if (!assigneeId) {
    throw new Error("Login ok but user id missing from response");
  }

  const day = date || getTodayDhaka();
  const nextWorking = getNextWorkingDay(day);

  const [todayTasks, tomorrowTasks] = await Promise.all([
    fetchDayTasks(token, assigneeId, day),
    fetchDayTasks(token, assigneeId, nextWorking),
  ]);

  return buildDailyMessage({
    date: day,
    nextDate: nextWorking,
    name,
    todayTasks,
    tomorrowTasks,
  });
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

/**
 * All-users day report from dueDate-only task lists (no assignee filter).
 * @param {{ token: string }} auth
 * @param {'today'|'next'} which
 */
async function runAllUsersDayReport(auth, which) {
  if (!auth?.token) {
    throw new Error("Missing auth token");
  }

  const today = getTodayDhaka();
  const date = which === "next" ? getNextWorkingDay(today) : today;
  const title =
    which === "next" ? "Next day tasks (all)" : "Daily report (all)";

  const tasks = await fetchAllDayTasksByDueDate(auth.token, date);
  const groups = groupTasksByAssignee(tasks);

  if (!groups.length) {
    return [`Date: ${date}`, title, "", "N/A"].join("\n") + "\n";
  }

  const blocks = groups.map((group) =>
    which === "today"
      ? formatUserDailyReportBlock(group.name, group.tasks, date)
      : `${nameHeader(group.name)}\n${formatTaskLines(group.tasks)}`,
  );

  return [`Date: ${date}`, title, "", blocks.join("\n\n")].join("\n") + "\n";
}

/** /etwt — estimated vs actual work time for one user over a due-date range. */
async function runEstimationWorkReport(auth, fromStr, toStr) {
  if (!auth?.token || !auth?.assigneeId) {
    throw new Error("Missing auth token or user id");
  }

  const tasks = await fetchRangeTasks(
    auth.token,
    auth.assigneeId,
    fromStr,
    toStr,
  );
  const header = [
    `<b>${escapeHtml(auth.name || "Unknown")}</b>`,
    `${fromStr} to ${toStr}`,
    DIVIDER,
  ].join("\n");

  if (!tasks.length) {
    return `${header}\nNo tasks due in this range.\n`;
  }

  let totalEstimate = 0;
  let totalWorked = 0;

  const lines = tasks.map((task) => {
    const estimate = taskEstimateMs(task);
    const worked = taskWorkedMsInRange(task, fromStr, toStr);
    totalEstimate += estimate;
    totalWorked += worked;
    const et = estimate ? formatDuration(estimate) : "N/A";
    const wt = worked ? formatDuration(worked) : "N/A";
    return [
      `#${escapeHtml(task.taskNumber || "")}: ${escapeHtml(task.title || "")}`,
      `ET: ${et} | WT: ${wt}`,
    ].join("\n");
  });

  const diff = totalWorked - totalEstimate;
  const diffLabel = totalEstimate
    ? `${diff >= 0 ? "+" : "-"}${formatDuration(Math.abs(diff))}`
    : "N/A";

  const totals = [
    DIVIDER,
    `<b>TOTAL ET: ${totalEstimate ? formatDuration(totalEstimate) : "N/A"}</b>`,
    `<b>TOTAL WT: ${totalWorked ? formatDuration(totalWorked) : "N/A"}</b>`,
    `<b>DIFF: ${diffLabel}</b>`,
  ].join("\n");

  return [header, lines.join("\n\n"), totals].join("\n\n") + "\n";
}

/**
 * /etwt_all — one Date | ET | WT table per user, one row per range.
 * The table goes inside <pre> so Telegram keeps the columns aligned.
 * @param {{ token: string }} auth
 * @param {{ from: string, to: string }[]} ranges
 */
async function runEstimationWorkAllReport(auth, ranges) {
  if (!auth?.token) {
    throw new Error("Missing auth token");
  }

  const perRange = await Promise.all(
    ranges.map((r) => fetchAllRangeTasks(auth.token, r.from, r.to)),
  );

  const label = (ms) => (ms ? formatDuration(ms) : "N/A");

  // name -> range index -> { et, wt }
  const users = new Map();
  perRange.forEach((tasks, i) => {
    for (const group of groupTasksByAssignee(tasks)) {
      if (!users.has(group.name)) users.set(group.name, new Map());
      users.get(group.name).set(
        i,
        group.tasks.reduce(
          (acc, task) => ({
            et: acc.et + taskEstimateMs(task),
            wt: acc.wt + taskWorkedMsInRange(task, ranges[i].from, ranges[i].to),
          }),
          { et: 0, wt: 0 },
        ),
      );
    }
  });

  if (!users.size) {
    return "No tasks due in these ranges.\n";
  }

  const blocks = [...users.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([name, byRange]) => {
      const rows = ranges.map((range, i) => {
        const { et, wt } = byRange.get(i) || { et: 0, wt: 0 };
        return [`${range.from} to ${range.to}`, label(et), label(wt)];
      });
      return `${nameHeader(name)}\n<pre>${renderTable(["Date", "ET", "WT"], rows)}</pre>`;
    });

  return blocks.join("\n\n") + "\n";
}

module.exports = {
  runPipeline,
  runAllUsersDayReport,
  runEstimationWorkReport,
  runEstimationWorkAllReport,
  resolveUserAuth,
  // re-exported so callers keep a single import site
  getAuth,
  getTodayDhaka,
  getNextWorkingDay,
  getRecentWeekRanges,
  isWithinActiveTaskAlertWindow,
  parseInputDate,
  apiBase,
};
