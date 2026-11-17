// The browser side of live characters. Every failure returns null, and the
// caller falls back to the scripted tree. The game never waits on this.

import type { LiveReply } from './sim/encounters/engine';
import { scrutinyLevel } from './sim/encounters/engine';
import { factsOf } from './sim/encounters/prompt';
import type { GameState } from './sim/state';

export const LIVE_TIMEOUT_MS = 8000;

export async function liveAvailable(apiKey: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetcher('/api/encounter', { headers: apiKey ? { 'x-qp-key': apiKey } : {} });
    if (!res.ok) return false;
    const data = (await res.json()) as { available?: boolean };
    return data.available === true;
  } catch {
    return false;
  }
}

export async function liveTurn(s: GameState, player: string, apiKey: string, fetcher: typeof fetch = fetch, timeoutMs = LIVE_TIMEOUT_MS): Promise<LiveReply | null> {
  const enc = s.encounter;
  if (!enc) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetcher('/api/encounter', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', ...(apiKey ? { 'x-qp-key': apiKey } : {}) },
      body: JSON.stringify({
        encounterId: enc.id,
        facts: factsOf(s),
        scrutiny: scrutinyLevel(s),
        memory: s.memory[enc.id] ?? [],
        transcript: enc.transcript,
        player,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<LiveReply>;
    if (typeof data.reply !== 'string') return null;
    return {
      reply: data.reply,
      disposition: typeof data.disposition === 'number' ? data.disposition : 0,
      flags: Array.isArray(data.flags) ? data.flags.filter((f) => typeof f === 'string') : [],
      end: data.end === true,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
