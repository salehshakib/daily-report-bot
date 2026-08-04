/**
 * Open in browser after deploy to check Blob env (does not reveal secrets):
 * https://YOUR_APP.vercel.app/api/debug-storage
 */
module.exports = async function handler(req, res) {
  const blobKeys = Object.keys(process.env)
    .filter(k => /BLOB/i.test(k))
    .sort();

  res.status(200).json({
    vercel: Boolean(process.env.VERCEL),
    vercelEnv: process.env.VERCEL_ENV || null,
    hasBlobReadWriteToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    hasBlobStoreId: Boolean(process.env.BLOB_STORE_ID),
    blobRelatedEnvKeys: blobKeys,
    tip: !process.env.BLOB_READ_WRITE_TOKEN
      ? 'Token not visible to this deployment. Add BLOB_READ_WRITE_TOKEN for Production, then Redeploy (Deployments → … → Redeploy).'
      : 'Token is available. /login should persist credentials.',
  });
};
