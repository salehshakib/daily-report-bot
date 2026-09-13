const { zonedMidnightUtc } = require("./dates");

const DAY_MS = 24 * 60 * 60 * 1000;

/** Task estimate: PM API returns `estimatedTime` as a minute count. */
const ESTIMATE_FIELD = "estimatedTime";
const ESTIMATE_UNIT_MS = 60 * 1000;

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

/** Overlap in ms between one worktime entry and [startMs, endMs). */
function entryOverlapMs(entry, startMs, endMs, now = Date.now()) {
  if (!entry?.startTime) return 0;
  const start = new Date(entry.startTime).getTime();
  const end = entry.endTime ? new Date(entry.endTime).getTime() : now;
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.max(0, Math.min(end, endMs) - Math.max(start, startMs));
}

function taskWorkedMsInRange(task, fromStr, toStr, now = Date.now()) {
  const rangeStart = zonedMidnightUtc(fromStr);
  const rangeEnd = zonedMidnightUtc(toStr) + DAY_MS;
  const worktime = Array.isArray(task?.worktime) ? task.worktime : [];
  return worktime.reduce(
    (sum, entry) => sum + entryOverlapMs(entry, rangeStart, rangeEnd, now),
    0,
  );
}

function taskWorkedMsOnDate(task, dateStr, now = Date.now()) {
  return taskWorkedMsInRange(task, dateStr, dateStr, now);
}

function taskEstimateMs(task) {
  const value = Number(task?.[ESTIMATE_FIELD]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value * ESTIMATE_UNIT_MS;
}

module.exports = {
  formatDuration,
  taskWorkedMsOnDate,
  taskWorkedMsInRange,
  taskEstimateMs,
};
