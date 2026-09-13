const { timezone } = require("./env");

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

/** Working week is Sun–Thu: Thursday rolls to Sunday. */
function getNextWorkingDay(todayStr) {
  const dow = weekdayInTimeZone(todayStr);
  if (dow === 4) return addDaysToDateStr(todayStr, 3);
  if (dow === 5) return addDaysToDateStr(todayStr, 2);
  if (dow === 6) return addDaysToDateStr(todayStr, 1);
  return addDaysToDateStr(todayStr, 1);
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

/** "dd-mm-yyyy" -> "yyyy-mm-dd". Throws on anything else. */
function parseInputDate(text) {
  const match = String(text || "")
    .trim()
    .match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) {
    throw new Error(`Bad date "${text}". Use dd-mm-yyyy, e.g. 13-09-2026`);
  }
  const [, dd, mm, yyyy] = match;
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) {
    throw new Error(`Bad date "${text}". Use dd-mm-yyyy, e.g. 13-09-2026`);
  }
  return `${yyyy}-${mm}-${dd}`;
}

/** "yyyy-mm-dd" -> "dd-mm-yyyy" for display. */
function toDisplayDate(dateStr) {
  const [y, m, d] = String(dateStr).split("-");
  return `${d}-${m}-${y}`;
}

module.exports = {
  formatDateInTimeZone,
  getTodayDhaka,
  getMinutesSinceMidnightDhaka,
  isWithinActiveTaskAlertWindow,
  addDaysToDateStr,
  weekdayInTimeZone,
  getNextWorkingDay,
  zonedMidnightUtc,
  parseInputDate,
  toDisplayDate,
};
