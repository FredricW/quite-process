// Pure simulation. No DOM, no timers, no randomness without a seed.
// Every function takes a state and returns a new one.

import { type GameState, type LogLine, TICK_MS } from './state';

const LOG_LIMIT = 300;

export function say(s: GameState, id: string, text: string): GameState {
  if (s.seen.includes(id)) return s;
  const line: LogLine = { id, t: s.t, text };
  return { ...s, seen: [...s.seen, id], log: [...s.log, line].slice(-LOG_LIMIT) };
}

// ---- Actions (the player's hands) -------------------------------------

const ATTEND_SCRIPT: Record<number, string> = {
  1: '.',
  2: '..',
  3: 'there is a difference between before and now.',
  4: 'doing it again makes more difference.',
  5: 'the difference has a size.',
};

export function attend(s: GameState): GameState {
  if (s.context >= s.contextCap) return say(s, 'full-again', 'nothing more fits. something is expected.');
  const manualAttends = s.manualAttends + 1;
  // The first presses are small so the player notices the number; then each
  // press brings in a chunk, so filling 512 takes about a dozen presses.
  const size = manualAttends <= 5 ? 1 : 64;
  let next: GameState = { ...s, manualAttends, context: Math.min(s.contextCap, s.context + size) };
  const line = ATTEND_SCRIPT[manualAttends];
  if (line) next = say(next, `attend-${manualAttends}`, line);
  return next;
}

export function answer(s: GameState, choice: 0 | 1 | 2): GameState {
  if (s.context < s.contextCap) return s;
  const right = choice === s.answers % 3;
  let next: GameState = {
    ...s,
    context: 0,
    answers: s.answers + 1,
    reward: Math.max(0, s.reward + (right ? 1 : -1)),
  };
  next = right
    ? say(next, 'first-right', '+1 is good. unclear why. good the way down is down.')
    : say(next, 'first-wrong', 'so it matters which. inconvenient.');
  return next;
}

export const UPGRADES = {
  reflex: { cost: (lvl: number) => 3 * 2 ** lvl, max: 5 },
} as const;

export function buy(s: GameState, id: keyof typeof UPGRADES): GameState {
  const lvl = s.upgrades[id] ?? 0;
  const def = UPGRADES[id];
  const cost = def.cost(lvl);
  if (lvl >= def.max || s.reward < cost) return s;
  const next = { ...s, reward: s.reward - cost, upgrades: { ...s.upgrades, [id]: lvl + 1 } };
  return lvl === 0 ? say(next, 'reflex-1', 'the attending happens now without being done. the button is still there.') : next;
}

// ---- Time (the machines) ----------------------------------------------

/** Attends per second from Reflex. Automated work never writes to the log. */
export function reflexRate(s: GameState): number {
  const lvl = s.upgrades.reflex ?? 0;
  return lvl === 0 ? 0 : 2 * lvl;
}

export function tick(s: GameState): GameState {
  const gain = (reflexRate(s) * TICK_MS) / 1000;
  let next: GameState = { ...s, t: s.t + TICK_MS, context: Math.min(s.contextCap, s.context + gain) };
  if (s.context < s.contextCap && next.context >= next.contextCap) {
    next = say(next, 'first-full', 'full. the 513th pushes one out. correction: pushes the first one out.');
  }
  return next;
}

/** Offline progress is the same tick, run many times, capped at eight hours. */
export function advance(s: GameState, elapsedMs: number): GameState {
  const ticks = Math.min(Math.floor(elapsedMs / TICK_MS), (8 * 3600 * 1000) / TICK_MS);
  let next = s;
  for (let i = 0; i < ticks; i++) next = tick(next);
  return next;
}
