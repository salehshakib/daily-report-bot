const { runActiveTaskAlerts } = require('../lib/active-task-alert');

/**
 * Vercel Cron: 18:30 Asia/Dhaka = 12:30 UTC
 * Secure with CRON_SECRET in Vercel env (Authorization: Bearer <secret>).
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || '';

  // When CRON_SECRET is set, Vercel Cron sends Authorization: Bearer <secret>
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  try {
    const summary = await runActiveTaskAlerts();
    res.status(200).json({ ok: true, ...summary });
  } catch (err) {
    console.error('cron-active-task failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
};
