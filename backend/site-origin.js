const DEFAULT_CLIENT_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173,https://*.vercel.app';

function getClientOrigins() {
  return (process.env.CLIENT_ORIGINS || DEFAULT_CLIENT_ORIGINS)
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function isAllowedClientOrigin(origin) {
  if (!origin) return false;
  return getClientOrigins().some((allowed) => {
    if (!allowed.includes('*')) return origin === allowed;
    const escaped = allowed.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-zA-Z0-9-]+');
    return new RegExp(`^${escaped}$`).test(origin);
  });
}

function getPublicSiteUrl(req) {
  const configuredOrigin = process.env.PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
  if (configuredOrigin) return configuredOrigin;

  const requestOrigin = req.get('origin')?.replace(/\/$/, '');
  if (isAllowedClientOrigin(requestOrigin)) return requestOrigin;

  throw new Error('Set PUBLIC_SITE_URL or allow the requesting frontend origin in CLIENT_ORIGINS.');
}

module.exports = { getClientOrigins, isAllowedClientOrigin, getPublicSiteUrl };
