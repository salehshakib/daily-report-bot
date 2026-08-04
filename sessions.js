const fs = require('fs');
const path = require('path');

const LOCAL_FILE = path.join(__dirname, 'sessions.json');
const BLOB_PATHNAME = 'sessions.json';

function useBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function loadLocal() {
  try {
    if (!fs.existsSync(LOCAL_FILE)) return {};
    return JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveLocal(sessions) {
  fs.writeFileSync(LOCAL_FILE, JSON.stringify(sessions, null, 2), 'utf8');
}

async function loadSessions() {
  if (!useBlob()) {
    return loadLocal();
  }

  try {
    const { get } = require('@vercel/blob');
    const result = await get(BLOB_PATHNAME, {
      access: 'private',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return {};
    }

    const chunks = [];
    for await (const chunk of result.stream) {
      chunks.push(Buffer.from(chunk));
    }
    const text = Buffer.concat(chunks).toString('utf8');
    const data = JSON.parse(text);
    return data && typeof data === 'object' ? data : {};
  } catch (err) {
    // Missing blob on first login is normal
    if (/not found|404|BlobNotFound/i.test(err.message || '')) {
      return {};
    }
    console.error('Failed to load sessions from Blob:', err.message);
    return {};
  }
}

async function saveSessions(sessions) {
  if (!useBlob()) {
    saveLocal(sessions);
    return;
  }

  try {
    const { put } = require('@vercel/blob');
    await put(BLOB_PATHNAME, JSON.stringify(sessions, null, 2), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
  } catch (err) {
    console.error('Failed to save sessions to Blob:', err.message);
    throw err;
  }
}

/**
 * Sessions JSON shape (Blob pathname: sessions.json):
 * {
 *   "<telegramUserId>": {
 *     "email": "...",
 *     "password": "...",
 *     "name": "...",
 *     "updatedAt": "..."
 *   }
 * }
 */
async function getSession(telegramUserId) {
  const sessions = await loadSessions();
  return sessions[String(telegramUserId)] || null;
}

async function setSession(telegramUserId, data) {
  const sessions = await loadSessions();
  const key = String(telegramUserId);
  sessions[key] = {
    ...sessions[key],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  await saveSessions(sessions);
  return sessions[key];
}

async function clearSession(telegramUserId) {
  const sessions = await loadSessions();
  delete sessions[String(telegramUserId)];
  await saveSessions(sessions);
}

/** Overwrite this user's record (does not merge). */
async function replaceSession(telegramUserId, data) {
  const sessions = await loadSessions();
  const key = String(telegramUserId);
  sessions[key] = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  await saveSessions(sessions);
  return sessions[key];
}

async function setPendingLogin(telegramUserId, pending) {
  await setSession(telegramUserId, { pendingLogin: pending });
}

async function clearPendingLogin(telegramUserId) {
  const sessions = await loadSessions();
  const key = String(telegramUserId);
  if (!sessions[key]) return;
  delete sessions[key].pendingLogin;
  if (!sessions[key].email && !sessions[key].password) {
    delete sessions[key];
  } else {
    sessions[key].updatedAt = new Date().toISOString();
  }
  await saveSessions(sessions);
}

module.exports = {
  getSession,
  setSession,
  clearSession,
  replaceSession,
  setPendingLogin,
  clearPendingLogin,
};
