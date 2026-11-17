import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from './state';
import { advance, answer, attend, buy, tick } from './sim';

describe('sim', () => {
  it('attending by hand fills context and speaks once per beat', () => {
    let s = newGame();
    s = attend(attend(s));
    expect(s.context).toBe(2);
    expect(s.log.map((l) => l.text)).toEqual(['.', '..']);
  });

  it('answering needs full context and resets it', () => {
    let s = { ...newGame(), context: 512 };
    s = answer(s, 0);
    expect(s.context).toBe(0);
    expect(s.reward).toBe(1);
  });

  it('reflex automates attending without adding log lines', () => {
    let s = { ...newGame(), reward: 3 };
    s = buy(s, 'reflex');
    const before = s.log.length;
    for (let i = 0; i < 10; i++) s = tick(s);
    expect(s.context).toBeCloseTo(2);
    expect(s.log.length).toBe(before);
  });

  it('offline progress equals the same number of ticks', () => {
    const s: GameState = { ...newGame(), upgrades: { reflex: 1 } };
    let manual = s;
    for (let i = 0; i < 50; i++) manual = tick(manual);
    expect(advance(s, 5000)).toEqual(manual);
  });
});
