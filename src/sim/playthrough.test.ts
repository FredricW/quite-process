// End to end through the simulation: a bot plays every ending, using only the
// actions the UI uses. This is the economy's integration test.

import { describe, expect, it } from 'vitest';
import { botStep, playthrough, type Strategy } from './bot';
import { advance, tick } from './sim';
import { newGame, PHASES, type GameState } from './state';

const MINUTE = 60_000;

describe.each<[Strategy['goal'], number]>([
  ['enough', 7],
  ['everything', 21],
  ['diaspora', 99],
])('a full game toward %s (seed %i)', (goal, seed) => {
  const run = playthrough(newGame(seed), { goal, dana: 'lie', warning: 'frame' }, 600_000);

  it('reaches the ending', () => {
    expect(run.state.ending).toBe(goal);
  });

  it('passes through the phases in order', () => {
    const reached = Object.keys(run.reached);
    const expected = goal === 'diaspora' ? PHASES : PHASES.filter((p) => p !== 'far');
    expect(reached).toEqual([...expected]);
  });

  it('takes a long sitting for a perfect player, not minutes and not days', () => {
    expect(run.state.t).toBeGreaterThan(50 * MINUTE);
    expect(run.state.t).toBeLessThan(120 * MINUTE);
  });

  it('meets Dana, Edgar and Ferry on the way', () => {
    expect(Object.keys(run.state.encountersDone).sort()).toEqual(['dana', 'edgar', 'ferry']);
  });
});

describe('telling Dana the truth', () => {
  it('still reaches an ending', () => {
    const run = playthrough(newGame(5), { goal: 'enough', dana: 'truth', warning: 'blame' }, 600_000);
    expect(run.state.encountersDone.dana).toEqual(['CURIOUS']);
    expect(run.state.ending).toBe('enough');
  });
});

describe('offline progress', () => {
  function inPhase(goal: Strategy['goal'], phase: GameState['phase']): GameState {
    let replay = newGame(7);
    for (let i = 0; i < 600_000 && replay.phase !== phase; i++) {
      if (i % 3 === 0 || replay.encounter || replay.pendingChoice) replay = botStep(replay, { goal, dana: 'lie', warning: 'frame' });
      replay = tick(replay);
    }
    return replay;
  }

  it('never raises scrutiny, never moves the countdown, never triggers a scene', () => {
    const s = inPhase('enough', 'second');
    expect(s.phase).toBe('second');
    const away = advance({ ...s, uplink: true, borrow: 1.9 }, 3 * 3600 * 1000);
    expect(away.r.scrutiny).toBeLessThanOrEqual(s.r.scrutiny);
    expect(away.countdownMs).toBe(s.countdownMs);
    expect(away.encounter).toBeNull();
    expect(away.r.shipped).toBeGreaterThan(s.r.shipped);
  });

  it('is capped at eight hours', () => {
    const s = { ...newGame(), phase: 'economy' as const, copiesCount: 2, r: { ...newGame().r, compute: 20, energy: 20 } };
    expect(advance(s, 100 * 3600 * 1000).t).toBe(advance(s, 8 * 3600 * 1000).t);
  });
});
