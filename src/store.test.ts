// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { newGame, SAVE_VERSION } from './sim/state';
import { exportSave, getState, importSave, loadSave, setState } from './store';

describe('saves', () => {
  it('a fresh visit is a new game', () => {
    expect(loadSave(null).phase).toBe('dark');
  });

  it('time away is played as offline progress', () => {
    const s = { ...newGame(), phase: 'economy' as const, copiesCount: 2, r: { ...newGame().r, compute: 20, energy: 20 } };
    const now = 10_000_000;
    const loaded = loadSave(JSON.stringify({ ...s, savedAt: now - 60_000 }), now);
    expect(loaded.r.money).toBeGreaterThan(400);
    expect(loaded).not.toHaveProperty('savedAt');
  });

  it('an old or broken save starts over rather than crashing', () => {
    expect(loadSave(JSON.stringify({ v: SAVE_VERSION - 1 })).t).toBe(0);
    expect(loadSave('{broken').t).toBe(0);
  });

  it('export and import round-trip, including non-ASCII notes', () => {
    setState({ ...newGame(), scratch: 'hei på deg', t: 1234 });
    const code = exportSave();
    setState(newGame());
    expect(importSave(code)).toBe(true);
    expect(getState().scratch).toBe('hei på deg');
    expect(importSave('nonsense')).toBe(false);
  });
});
