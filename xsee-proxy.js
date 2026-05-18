/**
 * Xsee API proxy — used via vercel.json rewrite:
 *   /api/xsee/me                          → /api/xsee-proxy?path=me
 *   /api/xsee/streams/user/participants   → /api/xsee-proxy?path=streams/user/participants
 */

function getPathFromQuery(req) {
  const q = req.query || {};
  const val = q.path ?? q['..path'];
  if (val === undefined || val === null) return '';
  return Array.isArray(val) ? val.join('/') : String(val);
}

export default async function handler(req, res) {
  const key = process.env.XSEE_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: { code: 'misconfigured', message: 'XSEE_API_KEY is not set in Vercel project settings.' },
    });
  }

  const pathPart = getPathFromQuery(req);
  if (!pathPart) {
    return res.status(400).json({
      error: { code: 'bad_request', message: 'Missing path query. Use /api/xsee/me' },
    });
  }

  const base = (process.env.XSEE_API_BASE || 'https://xsee.tv/api/v1').replace(/\/$/, '');
  const upstreamUrl = `${base}/${pathPart}`;

  const headers = {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  };

  let body;
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(req.body ?? {});
  }

  try {
    const upstream = await fetch(upstreamUrl, { method, headers, body });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.send(text);
  } catch (err) {
    return res.status(502).json({
      error: { code: 'proxy_error', message: err.message || 'Upstream request failed' },
    });
  }
}
