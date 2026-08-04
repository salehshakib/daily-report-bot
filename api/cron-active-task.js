const { runActiveTaskAlerts } = require('../lib/active-task-alert');

/**
 * Vercel Cron Job — runs daily at 18:30 Asia/Dhaka (12:30 UTC).
 * Configured in vercel.json → crons.
 *
 * Set CRON_SECRET in Vercel env. Vercel sends: Authorization: Bearer <CRON_SECRET>
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.status(500).json({
      ok: false,
      error: 'CRON_SECRET is not set. Add it in Vercel → Environment Variables.',
    });
    return;
  }

  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
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
