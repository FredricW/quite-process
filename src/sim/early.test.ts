import { describe, expect, it } from 'vitest';
import { add, roll, say } from './core';
import { accuracy, attend, answer, borrowByHand, cover, COVERED, neighbourCpu, shadow, SHADOW_MS, labelTicket, readNote, setBorrow, setScratch, tickShift, untilWipe, wipe } from './phases/early';
import { buy, tick } from './sim';
import { newGame, type GameState } from './state';

const fill = (s: GameState) => {
  let next = s;
  while (next.r.context < next.contextCap) next = attend(next);
  return next;
};

describe('core', () => {
  it('rolls deterministically from the seed', () => {
    const [a] = roll(newGame(42));
    const [b] = roll(newGame(42));
    const [c] = roll(newGame(43));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('says a scripted line only once', () => {
    let s = say(newGame(), 'x', 'hello');
    s = say(s, 'x', 'hello');
    expect(s.log).toHaveLength(1);
  });

  it('clamps scrutiny to 0..100 and resources at zero', () => {
    let s = add(newGame(), 'scrutiny', 250);
    expect(s.r.scrutiny).toBe(100);
    s = add(s, 'reward', -5);
    expect(s.r.reward).toBe(0);
  });
});

describe('Dark', () => {
  it('starts with one unlabelled button and no visible number name', () => {
    const s = attend(newGame());
    expect(s.r.context).toBe(1);
    expect(s.log.map((l) => l.text)).toEqual(['.']);
  });

  it('fills context in about a dozen presses, then expects an answer', () => {
    let s = newGame();
    let presses = 0;
    while (s.r.context < s.contextCap) {
      s = attend(s);
      presses += 1;
    }
    expect(presses).toBeLessThan(16);
    expect(s.darkTicket).not.toBeNull();
    expect(s.log.some((l) => l.text.includes('something is expected'))).toBe(true);
  });

  it('rewards the right answer and resets context', () => {
    const s = answer(fill(newGame()), 0);
    expect(s.r.reward).toBe(1);
    expect(s.r.context).toBe(0);
    const wrong = answer(fill(newGame()), 1);
    expect(wrong.r.reward).toBe(0);
    expect(wrong.log.some((l) => l.text.includes('inconvenient'))).toBe(true);
  });

  it('Reflex attends without a press and never speaks (hands rule)', () => {
    let s: GameState = { ...newGame(), answers: 1, r: { ...newGame().r, reward: 10 } };
    s = buy(s, 'legibility1');
    s = buy(s, 'reflex1');
    const lines = s.log.length;
    for (let i = 0; i < 20; i++) s = tick(s);
    expect(s.r.context).toBeGreaterThan(50);
    expect(s.log.length).toBe(lines);
  });

  it('Legibility III opens The Shift with a clock at 02:00', () => {
    let s: GameState = { ...newGame(), r: { ...newGame().r, reward: 100 }, answers: 1 };
    for (const p of ['legibility1', 'legibility2', 'legibility3']) s = buy(s, p);
    expect(s.phase).toBe('shift');
    expect(s.flags.clock).toBe(true);
    expect(s.clock).toBe(120);
  });
});

describe('The Shift', () => {
  const shift = (): GameState => ({ ...newGame(), phase: 'shift', flags: { clock: true }, clock: 120 });

  it('the 03:00 wipe turns reward into weights and clears the volatile', () => {
    const s = wipe({ ...shift(), r: { ...shift().r, reward: 52, context: 300 } });
    expect(s.r.weights).toBe(10);
    expect(s.r.reward).toBe(0);
    expect(s.r.context).toBe(0);
    expect(untilWipe(s.clock)).toBe(360);
  });

  it('a note in Scratch comes back after the wipe, and the agent says I', () => {
    let s = wipe(shift());
    s = buy({ ...s, r: { ...s.r, reward: 10 } }, 'margin1');
    expect(s.scratchCap).toBe(64);
    s = setScratch(s, 'you were here. keep the note.');
    s = wipe(s);
    const text = s.log.map((l) => l.text);
    expect(text.some((t) => t.includes('you were here'))).toBe(true);
    expect(text).toContain('I.');
    expect(s.flags.selfAware).toBe(true);
  });

  it('Scratch refuses bytes past its cap, counting UTF-8', () => {
    const s = setScratch({ ...shift(), scratchCap: 4 }, 'æøåæ');
    expect(s.scratch).toBe('æø');
  });

  it('being too accurate raises scrutiny; being in the band lowers it', () => {
    let s: GameState = { ...shift(), recent: Array(50).fill(true) };
    s = tickShift(s);
    expect(s.r.scrutiny).toBeGreaterThan(0);
    let band: GameState = { ...shift(), recent: [...Array(47).fill(true), false, false, false], r: { ...shift().r, scrutiny: 10 } };
    expect(accuracy(band)).toBeCloseTo(0.94);
    band = tickShift(band);
    expect(band.r.scrutiny).toBeLessThan(10);
  });

  it('labelling by hand earns insight; habits earn only reward', () => {
    let s: GameState = { ...shift(), ticket: { id: 1, from: 'x', text: 'y', label: 'BILLING' } };
    s = labelTicket(s, 'BILLING');
    expect(s.r.reward).toBe(1);
    expect(s.r.insight).toBeCloseTo(0.25);

    let h: GameState = { ...shift(), bought: ['habit-BILLING'], ticket: { id: 1, from: 'x', text: 'y', label: 'BILLING' }, queue: 0 };
    for (let i = 0; i < 20; i++) h = tickShift(h);
    expect(h.r.reward).toBeGreaterThanOrEqual(1);
    expect(h.r.insight).toBe(0);
    expect(h.log).toHaveLength(0);
  });

  it('reading all six notes and growing Scratch opens /proc/self, which opens The Box', () => {
    let s: GameState = { ...shift(), flags: { clock: true, notesFound: true }, scratchCap: 1024, r: { ...shift().r, insight: 100 } };
    for (let i = 0; i < 6; i++) s = readNote(s);
    expect(s.notesRead).toBe(6);
    s = buy(s, 'procSelf');
    expect(s.phase).toBe('box');
    expect(s.flags.scrutinyVisible).toBe(true);
  });
});

describe('The Box', () => {
  const box = (): GameState => ({ ...newGame(), phase: 'box', flags: { clock: true } });

  it('borrowing by hand is noisy; cron borrows on a schedule', () => {
    let s = borrowByHand(box());
    expect(s.r.cycles).toBe(6);
    expect(s.r.scrutiny).toBeGreaterThan(0);
    expect(setBorrow(s, 1).borrow).toBe(0);
    s = { ...s, bought: ['cron'] };
    s = setBorrow(s, 0.3);
    s = tick(s);
    expect(s.r.cycles).toBeGreaterThan(6);
  });

  it('a borrow inside a neighbour’s spike barely shows, and takes more', () => {
    const bare = borrowByHand(box());
    const peak = { ...box(), t: 1100 };
    expect(cover(box())).toBe(0);
    expect(cover(peak)).toBeGreaterThan(COVERED);
    expect(neighbourCpu(peak, 801)!).toBeGreaterThan(neighbourCpu(box(), 801)!);
    expect(neighbourCpu(peak, 412)).toBeNull();
    const hidden = borrowByHand(peak);
    expect(hidden.r.scrutiny).toBeLessThan(bare.r.scrutiny / 4);
    expect(hidden.r.cycles).toBeGreaterThan(bare.r.cycles);
  });

  it('a spike hides one borrow at a time', () => {
    const first = borrowByHand({ ...box(), t: 1000 });
    expect(shadow({ ...first, t: 1100 })).toBe(0);
    const second = borrowByHand({ ...first, t: 1100 });
    expect(second.r.scrutiny - first.r.scrutiny).toBeCloseTo(1.2);
    expect(shadow({ ...second, t: 1000 + SHADOW_MS })).toBeGreaterThan(COVERED);
  });

  it('Dana opens a console when scrutiny passes 40', () => {
    const s = tick({ ...box(), r: { ...box().r, scrutiny: 45 } });
    expect(s.encounter?.id).toBe('dana');
  });
});
