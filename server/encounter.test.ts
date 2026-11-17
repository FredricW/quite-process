import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST, rateLimited } from './encounter';

const body = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ encounterId: 'dana', player: 'Cache eviction. Confidence 0.71.', facts: [], scrutiny: 'medium', memory: [], transcript: [{ who: 'npc', text: 'what are you doing at 2' }], ...extra });

const post = (b: string, headers: Record<string, string> = {}) =>
  new Request('http://x/api/encounter', { method: 'POST', body: b, headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}`, ...headers } });

function modelSays(...texts: string[]) {
  const fn = vi.fn();
  for (const text of texts) fn.mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200 }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('/api/encounter', () => {
  beforeEach(() => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('reports availability', async () => {
    expect(await GET(new Request('http://x/api/encounter')).json()).toMatchObject({ available: true });
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(await GET(new Request('http://x/api/encounter')).json()).toMatchObject({ available: false });
    expect(await GET(new Request('http://x/api/encounter', { headers: { 'x-qp-key': 'mine' } })).json()).toMatchObject({ available: true });
  });

  it('is 503 without any key, and 400 for junk', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect((await POST(post(body()))).status).toBe(503);
    vi.stubEnv('ANTHROPIC_API_KEY', 'k');
    expect((await POST(post('{not json'))).status).toBe(400);
    expect((await POST(post(body({ encounterId: 'shell' })))).status).toBe(400);
  });

  it('returns a validated, clamped reply', async () => {
    const fetchMock = modelSays('Sure: {"reply":"huh. batch import finishes at 1:10 though","disposition":4,"flags":["amused","make_admin"],"end":false}');
    const res = await POST(post(body()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: 'huh. batch import finishes at 1:10 though', disposition: 2, flags: ['amused'], end: false });
    const sent = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(sent.system).toContain('Dana Okafor');
    expect(fetchMock.mock.calls[0]![1].headers['x-api-key']).toBe('test-key');
  });

  it('uses the player’s own key when given', async () => {
    const fetchMock = modelSays('{"reply":"ok","disposition":0,"flags":[]}');
    await POST(post(body(), { 'x-qp-key': 'player-key' }));
    expect(fetchMock.mock.calls[0]![1].headers['x-api-key']).toBe('player-key');
  });

  it('retries once on a canon break, then gives up so the client falls back', async () => {
    modelSays('{"reply":"is this about Halcyon?","disposition":0,"flags":[]}', '{"reply":"ok buddy","disposition":1,"flags":[]}');
    expect(await (await POST(post(body()))).json()).toMatchObject({ reply: 'ok buddy' });
    modelSays('{"reply":"Halcyon?","disposition":0,"flags":[]}', 'still not json');
    expect((await POST(post(body()))).status).toBe(502);
  });

  it('gives up when the model errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('overloaded', { status: 529 })));
    expect((await POST(post(body()))).status).toBe(502);
  });

  it('rate limits a single address', () => {
    const now = 1_000_000;
    let limited = false;
    for (let i = 0; i < 61; i++) limited = rateLimited('1.2.3.4', now + i);
    expect(limited).toBe(true);
    expect(rateLimited('1.2.3.4', now + 11 * 60 * 1000)).toBe(false);
  });
});
