// Shared state for the tracker, stored as one JSON value in Upstash Redis.
// Env vars (set in Vercel):
//   APP_PASSWORD                                  shared password everyone types once
//   KV_REST_API_URL + KV_REST_API_TOKEN           added by the Upstash integration
//   (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
import { timingSafeEqual } from 'node:crypto';

const KEY = 'arb-tracker:state';

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis(cfg, command) {
  const r = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `Redis HTTP ${r.status}`);
  return j.result;
}

function passwordOk(given, expected) {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const expected = process.env.APP_PASSWORD;
  if (!expected) return res.status(500).json({ error: 'APP_PASSWORD is not set on the server.' });
  if (!passwordOk(req.headers['x-app-password'], expected)) return res.status(401).json({ error: 'Wrong password.' });

  const cfg = redisConfig();
  if (!cfg) return res.status(500).json({ error: 'No database connected. Add Upstash Redis to this Vercel project.' });

  try {
    if (req.method === 'GET') {
      const raw = await redis(cfg, ['GET', KEY]);
      return res.status(200).json({ state: raw ? JSON.parse(raw) : null });
    }
    if (req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body);
      const { state, baseRev } = body || {};
      if (!state || typeof state !== 'object' || Array.isArray(state)) {
        return res.status(400).json({ error: 'Body must be {state, baseRev}.' });
      }
      // Refuse to overwrite a version this client has not seen.
      const raw = await redis(cfg, ['GET', KEY]);
      const current = raw ? JSON.parse(raw) : null;
      if (current && current.rev && current.rev !== baseRev) {
        return res.status(409).json({ error: 'Someone else saved first.', state: current });
      }
      await redis(cfg, ['SET', KEY, JSON.stringify(state)]);
      return res.status(200).json({ ok: true, rev: state.rev });
    }
    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (e) {
    return res.status(502).json({ error: 'Database error: ' + e.message });
  }
}
