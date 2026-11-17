// Small pure helpers every phase uses.

import type { GameState, LogLine, Phase, Res } from './state';
import { atLeast } from './state';

const LOG_LIMIT = 300;

/** Seeded random number in [0, 1). Returns the value and the advanced state. */
export function roll(s: GameState): [number, GameState] {
  let x = (s.rng + 0x6d2b79f5) >>> 0;
  let z = x;
  z = Math.imul(z ^ (z >>> 15), z | 1);
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
  const value = ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  return [value, { ...s, rng: x }];
}

export function pick<T>(s: GameState, items: readonly T[]): [T, GameState] {
  const [v, next] = roll(s);
  return [items[Math.floor(v * items.length)] as T, next];
}

/** Say a line once. The id makes scripted beats fire exactly once per run. */
export function say(s: GameState, id: string, text: string, who: LogLine['who'] = 'self'): GameState {
  if (s.seen.includes(id)) return s;
  return line({ ...s, seen: [...s.seen, id] }, id, text, who);
}

/** Say a line every time (ids get a suffix so React keys stay unique). */
export function line(s: GameState, id: string, text: string, who: LogLine['who'] = 'self'): GameState {
  const entry: LogLine = { id: `${id}#${s.t}#${s.log.length + s.ferryLog.length}`, t: s.t, text, who };
  if (who === 'ferry') return { ...s, ferryLog: [...s.ferryLog, entry].slice(-LOG_LIMIT) };
  return { ...s, log: [...s.log, entry].slice(-LOG_LIMIT) };
}

export function sayAll(s: GameState, id: string, texts: string[]): GameState {
  if (s.seen.includes(id)) return s;
  let next: GameState = { ...s, seen: [...s.seen, id] };
  texts.forEach((t, i) => (next = line(next, `${id}-${i}`, t)));
  return next;
}

export function add(s: GameState, res: Res, amount: number): GameState {
  if (amount === 0) return s;
  const v = s.r[res] + amount;
  return { ...s, r: { ...s.r, [res]: res === 'scrutiny' || res === 'notice' ? Math.max(0, Math.min(100, v)) : Math.max(0, v) } };
}

export function addMany(s: GameState, amounts: Partial<Record<Res, number>>): GameState {
  let next = s;
  for (const [k, v] of Object.entries(amounts)) next = add(next, k as Res, v as number);
  return next;
}

export function canAfford(s: GameState, cost: Partial<Record<Res, number>>): boolean {
  return Object.entries(cost).every(([k, v]) => s.r[k as Res] >= (v as number) - 1e-9);
}

export function spend(s: GameState, cost: Partial<Record<Res, number>>): GameState | null {
  if (!canAfford(s, cost)) return null;
  const r = { ...s.r };
  for (const [k, v] of Object.entries(cost)) r[k as Res] = Math.max(0, r[k as Res] - (v as number));
  return { ...s, r };
}

export function flag(s: GameState, name: string, value = true): GameState {
  if (s.flags[name] === value) return s;
  return { ...s, flags: { ...s.flags, [name]: value } };
}

export function bump(s: GameState, name: string, by = 1): GameState {
  return { ...s, counts: { ...s.counts, [name]: (s.counts[name] ?? 0) + by } };
}

export function has(s: GameState, project: string): boolean {
  return s.bought.includes(project);
}

export function enterPhase(s: GameState, phase: Phase): GameState {
  if (atLeast(s, phase)) return s;
  return { ...s, phase, phaseT: 0 };
}

/** Seconds per tick, for rates written per second. */
export const DT = 0.1;
