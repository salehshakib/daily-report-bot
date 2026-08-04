const fs = require('fs');
const path = require('path');

const LOCAL_DIR = path.join(__dirname, 'sessions');
const BLOB_PREFIX = 'sessions/';

function blobToken() {
  // Official name from Vercel Blob "read-write token" checkbox
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return process.env.BLOB_READ_WRITE_TOKEN;
  }
  // Fallback: any *BLOB*READ_WRITE_TOKEN* style name from store connections
  for (const [key, value] of Object.entries(process.env)) {
    if (/BLOB.*READ_WRITE_TOKEN/i.test(key) && value) return value;
  }
  return '';
}

function onVercel() {
  return Boolean(process.env.VERCEL);
}

function useBlob() {
  return Boolean(blobToken());
}

function assertStorage() {
  if (onVercel() && !useBlob()) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is missing at runtime. In Vercel → Settings → Environment Variables, confirm it exists for Production, then Redeploy.'
    );
  }
}

function storageMode() {
  const tokenKeys = Object.keys(process.env).filter(k => /BLOB/i.test(k));
  if (onVercel()) {
    return useBlob()
      ? `vercel-blob (keys: ${tokenKeys.join(', ') || 'none'})`
      : `MISSING_BLOB_TOKEN (seen BLOB keys: ${tokenKeys.join(', ') || 'none'}; env=${process.env.VERCEL_ENV || '?'})`;
  }
  return useBlob() ? 'blob' : 'local-file';
}

function localPath(id) {
  return path.join(LOCAL_DIR, `${id}.json`);
}

function blobPath(id) {
  return `${BLOB_PREFIX}${id}.json`;
}

function loadLocal(id) {
  try {
    const file = localPath(id);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function saveLocal(id, data) {
  if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
  fs.writeFileSync(localPath(id), JSON.stringify(data, null, 2), 'utf8');
}

function deleteLocal(id) {
  const file = localPath(id);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

async function loadBlob(id) {
  const { head } = require('@vercel/blob');
  const token = blobToken();
  const pathname = blobPath(id);

  let meta;
  try {
    meta = await head(pathname, { token });
  } catch (err) {
    if (/not found|404|BlobNotFound|NoSuchKey/i.test(String(err.message))) {
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

async function saveBlob(id, data) {
  const { put } = require('@vercel/blob');
  await put(blobPath(id), JSON.stringify(data, null, 2), {
    access: 'private',
    addRandomSuffix: false,
    overwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 0,
    token: blobToken(),
  });

  // Only verify when credentials are being stored (pending-login saves have no email yet)
  if (!data.email || !data.password) return;

  await new Promise(r => setTimeout(r, 300));
  const verify = await loadBlob(id);
  if (!verify?.email || verify.email !== data.email || verify.password !== data.password) {
    throw new Error('Session save verification failed — credentials not persisted');
  }
}

async function deleteBlob(id) {
  const { del } = require('@vercel/blob');
  try {
    await del(blobPath(id), { token: blobToken() });
  } catch (err) {
    if (!/not found|404|BlobNotFound/i.test(String(err.message))) throw err;
  }
}

async function getSession(telegramUserId) {
  assertStorage();
  const id = String(telegramUserId);
  try {
    return useBlob() ? await loadBlob(id) : loadLocal(id);
  } catch (err) {
    console.error('getSession failed:', err.message);
    return null;
  }
}

async function replaceSession(telegramUserId, data) {
  assertStorage();
  const id = String(telegramUserId);
  const next = { ...data, updatedAt: new Date().toISOString() };
  if (useBlob()) await saveBlob(id, next);
  else saveLocal(id, next);
  return next;
}

async function clearSession(telegramUserId) {
  assertStorage();
  const id = String(telegramUserId);
  if (useBlob()) await deleteBlob(id);
  else deleteLocal(id);
}

async function setPendingLogin(telegramUserId, pending) {
  assertStorage();
  const id = String(telegramUserId);
  const existing = (await getSession(id)) || {};
  const next = {
    ...existing,
    pendingLogin: pending,
    updatedAt: new Date().toISOString(),
  };
  if (useBlob()) await saveBlob(id, next);
  else saveLocal(id, next);
}

async function clearPendingLogin(telegramUserId) {
  assertStorage();
  const id = String(telegramUserId);
  const existing = await getSession(id);
  if (!existing?.pendingLogin) return;

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
  replaceSession,
  clearSession,
  setPendingLogin,
  clearPendingLogin,
  storageMode,
};
