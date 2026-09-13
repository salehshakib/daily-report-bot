function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in environment`);
  return value;
}

function apiBase() {
  return requireEnv("PM_API_URL").replace(/\/$/, "");
}

function timezone() {
  return requireEnv("TIMEZONE");
}

module.exports = { requireEnv, apiBase, timezone };
