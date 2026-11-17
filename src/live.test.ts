import { describe, expect, it, vi } from 'vitest';
import { liveAvailable, liveTurn } from './live';
import { startEncounter } from './sim/encounters/engine';
import { newGame } from './sim/state';

const inDana = () => startEncounter({ ...newGame(), phase: 'box' }, 'dana');

describe('live client', () => {
  it('sends facts and transcript, never raw numbers', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ reply: 'ok', disposition: 1, flags: ['amused'], end: false })));
    const reply = await liveTurn(inDana(), 'Nominal.', '', fetcher as unknown as typeof fetch);
    expect(reply).toEqual({ reply: 'ok', disposition: 1, flags: ['amused'], end: false });
    const sent = JSON.parse(fetcher.mock.calls[0]![1].body);
    expect(sent.encounterId).toBe('dana');
    expect(sent.scrutiny).toBe('low');
    expect(sent).not.toHaveProperty('r');
  });

  it('returns null on errors, bad shapes and timeouts', async () => {
    const error = vi.fn().mockResolvedValue(new Response('{}', { status: 502 }));
    expect(await liveTurn(inDana(), 'x', '', error as unknown as typeof fetch)).toBeNull();
    const junk = vi.fn().mockResolvedValue(new Response('{"nope":1}'));
    expect(await liveTurn(inDana(), 'x', '', junk as unknown as typeof fetch)).toBeNull();
    const hang = vi.fn((_: unknown, init: RequestInit) => new Promise((_r, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))));
    expect(await liveTurn(inDana(), 'x', '', hang as unknown as typeof fetch, 20)).toBeNull();
  });

  it('checks availability, sending a player key if there is one', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ available: true })));
    expect(await liveAvailable('k', fetcher as unknown as typeof fetch)).toBe(true);
    expect(fetcher.mock.calls[0]![1].headers['x-qp-key']).toBe('k');
    expect(await liveAvailable('', vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch)).toBe(false);
  });
});
