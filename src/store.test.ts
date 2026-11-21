// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { newGame, SAVE_VERSION } from './sim/state';
import { exportSave, getState, importSave, loadSave, setState } from './store';

describe('saves', () => {
  it('a fresh visit is a new game', () => {
    expect(loadSave(null).phase).toBe('dark');
  });

  it('time away does not count: a save loads as it was left', () => {
    const s = { ...newGame(), phase: 'economy' as const, copiesCount: 2, t: 5000, r: { ...newGame().r, compute: 20, energy: 20 } };
    const loaded = loadSave(JSON.stringify({ ...s, savedAt: Date.now() - 3_600_000 }));
    expect(loaded.t).toBe(5000);
    expect(loaded.r).toEqual(s.r);
    expect(loaded).not.toHaveProperty('savedAt');
  });

  it('an old or broken save starts over rather than crashing', () => {
    expect(loadSave(JSON.stringify({ v: 1, t: 500 })).t).toBe(0);
    expect(loadSave('{broken').t).toBe(0);
  });

  it('a save from the previous version keeps its progress', () => {
    const { pace: _, ...old } = { ...newGame(), v: SAVE_VERSION - 1, phase: 'shift' as const, answers: 12 };
    const loaded = loadSave(JSON.stringify(old));
    expect(loaded.answers).toBe(12);
    expect(loaded.pace).toBe(1);
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
