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

const BAD_DATE = 'Use yyyy-mm-dd, e.g. 2026-09-13';

/**
 * Normalise a typed date to the canonical "yyyy-mm-dd" used everywhere else.
 * "dd-mm-yyyy" is accepted too — the 4-digit year tells the two apart.
 */
function parseInputDate(text) {
  const trimmed = String(text || "").trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmy = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  const [yyyy, mm, dd] = iso
    ? iso.slice(1)
    : dmy
      ? [dmy[3], dmy[2], dmy[1]]
      : [];

  if (!yyyy) throw new Error(`Bad date "${text}". ${BAD_DATE}`);
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) {
    throw new Error(`Bad date "${text}". ${BAD_DATE}`);
  }
  return `${yyyy}-${mm}-${dd}`;
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
};
