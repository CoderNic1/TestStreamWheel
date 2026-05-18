/**
 * StreamWheel → Xsee API proxy (keeps xsee_live_ key server-side).
 * Frontend: fetch('/api/xsee/streams/username/participants')
 */
export default async function handler(req, res) {
  const key = process.env.XSEE_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: { code: 'misconfigured', message: 'XSEE_API_KEY is not set in Vercel project settings.' },
    });
  }

  const segments = req.query.path;
  const pathPart = Array.isArray(segments) ? segments.join('/') : String(segments || '');
  if (!pathPart) {
    return res.status(400).json({ error: { code: 'bad_request', message: 'Missing API path' } });
  }

  const base = (process.env.XSEE_API_BASE || 'https://xsee.tv/api/v1').replace(/\/$/, '');
  const url = `${base}/${pathPart}`;

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
    const upstream = await fetch(url, { method, headers, body });
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
