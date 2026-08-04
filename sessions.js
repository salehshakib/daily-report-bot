const fs = require('fs');
const path = require('path');

const SESSIONS_FILE = process.env.VERCEL
  ? path.join('/tmp', 'sessions.json')
  : path.join(__dirname, 'sessions.json');

function loadSessions() {
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return {};
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveSessions(sessions) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
}

function getSession(telegramUserId) {
  const sessions = loadSessions();
  return sessions[String(telegramUserId)] || null;
}

function setSession(telegramUserId, data) {
  const sessions = loadSessions();
  const key = String(telegramUserId);
  sessions[key] = {
    ...sessions[key],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  saveSessions(sessions);
  return sessions[key];
}

function clearSession(telegramUserId) {
  const sessions = loadSessions();
  delete sessions[String(telegramUserId)];
  saveSessions(sessions);
}

function setPendingLogin(telegramUserId, pending) {
  setSession(telegramUserId, { pendingLogin: pending });
}

function clearPendingLogin(telegramUserId) {
  const sessions = loadSessions();
  const key = String(telegramUserId);
  if (!sessions[key]) return;
  delete sessions[key].pendingLogin;
  // Drop empty stubs that only had pendingLogin
  if (!sessions[key].email && !sessions[key].password) {
    delete sessions[key];
  } else {
    sessions[key].updatedAt = new Date().toISOString();
  }
  saveSessions(sessions);
}

module.exports = {
  getSession,
  setSession,
  clearSession,
  setPendingLogin,
  clearPendingLogin,
};
