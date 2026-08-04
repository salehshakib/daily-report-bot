const fs = require('fs');
const path = require('path');

const LOCAL_DIR = path.join(__dirname, 'sessions');
const BLOB_PREFIX = 'sessions/';

function useBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function localPath(telegramUserId) {
  return path.join(LOCAL_DIR, `${telegramUserId}.json`);
}

function blobPath(telegramUserId) {
  return `${BLOB_PREFIX}${telegramUserId}.json`;
}

function ensureLocalDir() {
  if (!fs.existsSync(LOCAL_DIR)) {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
  }
}

function loadLocal(telegramUserId) {
  try {
    const file = localPath(telegramUserId);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function saveLocal(telegramUserId, data) {
  ensureLocalDir();
  fs.writeFileSync(localPath(telegramUserId), JSON.stringify(data, null, 2), 'utf8');
}

function deleteLocal(telegramUserId) {
  const file = localPath(telegramUserId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

async function loadBlob(telegramUserId) {
  const { head } = require('@vercel/blob');
  const pathname = blobPath(telegramUserId);
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  let meta;
  try {
    meta = await head(pathname, { token });
  } catch (err) {
    if (/not found|404|BlobNotFound|NoSuchKey/i.test(err.message || '')) {
      return null;
    }
    throw err;
  }

  const base = meta.downloadUrl || meta.url;
  const url = `${base}${base.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Blob fetch failed: ${res.status}`);
  const data = await res.json();
  return data && typeof data === 'object' ? data : null;
}

async function saveBlob(telegramUserId, data) {
  const { put } = require('@vercel/blob');
  const pathname = blobPath(telegramUserId);
  const body = JSON.stringify(data, null, 2);

  await put(pathname, body, {
    access: 'private',
    addRandomSuffix: false,
    overwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 0,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  // Verify write is readable (avoid silent CDN/stale failures)
  const verify = await loadBlob(telegramUserId);
  if (!verify || verify.email !== data.email) {
    throw new Error('Session save verification failed — credentials not persisted');
  }
}

async function deleteBlob(telegramUserId) {
  const { del } = require('@vercel/blob');
  try {
    await del(blobPath(telegramUserId), {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
  } catch (err) {
    if (!/not found|404|BlobNotFound/i.test(err.message || '')) {
      throw err;
    }
  }
}

async function getSession(telegramUserId) {
  const id = String(telegramUserId);
  try {
    if (useBlob()) return await loadBlob(id);
    return loadLocal(id);
  } catch (err) {
    console.error('getSession failed:', err.message);
    return null;
  }
}

async function setSession(telegramUserId, data) {
  const id = String(telegramUserId);
  const existing = (await getSession(id)) || {};
  const next = {
    ...existing,
    ...data,
    updatedAt: new Date().toISOString(),
  };
  if (next.pendingLogin == null) delete next.pendingLogin;

  if (useBlob()) await saveBlob(id, next);
  else saveLocal(id, next);
  return next;
}

async function replaceSession(telegramUserId, data) {
  const id = String(telegramUserId);
  const next = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  if (useBlob()) await saveBlob(id, next);
  else saveLocal(id, next);
  return next;
}

async function clearSession(telegramUserId) {
  const id = String(telegramUserId);
  if (useBlob()) await deleteBlob(id);
  else deleteLocal(id);
}

async function setPendingLogin(telegramUserId, pending) {
  await setSession(telegramUserId, { pendingLogin: pending });
}

async function clearPendingLogin(telegramUserId) {
  const id = String(telegramUserId);
  const existing = await getSession(id);
  if (!existing) return;

  delete existing.pendingLogin;
  if (!existing.email && !existing.password) {
    await clearSession(id);
    return;
  }

  existing.updatedAt = new Date().toISOString();
  if (useBlob()) await saveBlob(id, existing);
  else saveLocal(id, existing);
}

module.exports = {
  getSession,
  setSession,
  clearSession,
  replaceSession,
  setPendingLogin,
  clearPendingLogin,
};
