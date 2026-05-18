/**
 * StreamWheel → Xsee API proxy (keeps xsee_live_ key server-side).
 * Frontend: fetch('/api/xsee/me')  fetch('/api/xsee/streams/username/participants')
 */

/** Vercel catch-all often exposes the segment as query "..path" (see deployment logs). */
function getApiPath(req) {
  const q = req.query || {};

  const direct = [q.path, q['..path'], q['...path']];
  for (const c of direct) {
    if (!c) continue;
    const part = Array.isArray(c) ? c.join('/') : String(c);
    if (part) return part;
  }

  for (const key of Object.keys(q)) {
    if (key.replace(/\./g, '') === 'path') {
      const val = q[key];
      const part = Array.isArray(val) ? val.join('/') : String(val || '');
      if (part) return part;
    }
  }

  const raw = req.url || '';
  let pathname = raw.split('?')[0];
  try {
    const base = raw.startsWith('http') ? undefined : 'https://stream-wheel.vercel.app';
    pathname = new URL(raw, base).pathname;
  } catch (_) { /* use split result */ }

  if (pathname.startsWith('/api/xsee/')) {
    const rest = pathname.slice('/api/xsee/'.length).replace(/^\/+/, '');
    if (rest) return decodeURIComponent(rest);
  }

  return '';
}

export default async function handler(req, res) {
  const key = process.env.XSEE_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: { code: 'misconfigured', message: 'XSEE_API_KEY is not set in Vercel project settings.' },
    });
  }

  const pathPart = getApiPath(req);
  if (!pathPart) {
    return res.status(400).json({
      error: {
        code: 'bad_request',
        message: 'Missing API path. Use /api/xsee/me (not /api/xsee alone).',
      },
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
