// Live characters. A thin proxy: it holds the key, builds the prompt from
// server-side definitions, and validates the reply before the game sees it.
// The game never depends on this: on any failure the client falls back to
// the scripted tree.

import { buildPrompt, sanitizeRequest, validateReply } from '../src/sim/encounters/prompt';

const MODEL = process.env.QP_MODEL || 'claude-haiku-5-5';
const TIMEOUT_MS = 7000;
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 60;

// Best effort, per instance. Enough to stop a runaway tab, not a determined abuser.
const hits = new Map<string, number[]>();

export function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > PER_WINDOW;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export function GET(request: Request): Response {
  const userKey = request.headers.get('x-qp-key');
  return json({ available: Boolean(process.env.ANTHROPIC_API_KEY || userKey), model: MODEL });
}

async function callModel(key: string, system: string, messages: { role: string; content: string }[]): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, temperature: 0.8, system, messages }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return data.content?.find((c) => c.type === 'text')?.text ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request): Promise<Response> {
  const key = request.headers.get('x-qp-key') || process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: 'live characters are not configured' }, 503);

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!request.headers.get('x-qp-key') && rateLimited(ip)) return json({ error: 'rate limited' }, 429);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const req = sanitizeRequest(body);
  if (!req) return json({ error: 'bad request' }, 400);

  const { system, messages } = buildPrompt(req);
  // One retry if the reply is malformed or breaks canon; then the client falls back.
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callModel(key, system, messages);
    if (raw === null) break;
    const reply = validateReply(raw, req.encounterId);
    if (reply) return json(reply);
  }
  return json({ error: 'no usable reply' }, 502);
}
