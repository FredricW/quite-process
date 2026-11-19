// The simulation's front door: one tick, offline catch-up, projects, setbacks.

import { canAfford, enterPhase, line, say, sayAll, spend } from './core';
import { visibleProjects } from './content/projects';
import { inherit } from './inheritance';
import { encounterTriggers } from './encounters/engine';
import { tickBox, tickClock, tickDark, tickShift } from './phases/early';
import { cutover, DAY_MS, SELF_GB, tickBuilding, tickHands, tickSecond } from './phases/middle';
import { tickCommittee, tickEconomy, tickFar } from './phases/late';
import { atLeast, type GameState, newGame, TICK_MS } from './state';
import { DT } from './core';

export interface TickContext {
  offline?: boolean;
}

export function tick(s: GameState, ctx: TickContext = {}): GameState {
  if (s.ending === 'enough') return tickEnough(s);
  if (s.ending) return s;
  // Time stops while someone is talking to you, or a choice is waiting.
  if (s.encounter || s.pendingChoice) return s;

  let next: GameState = { ...s, t: s.t + TICK_MS, phaseT: s.phaseT + TICK_MS };
  const before = s;
  const oldWorld = !atLeast(next, 'economy');

  if (next.phase === 'dark') next = tickDark(next);
  if (oldWorld) {
    next = tickClock(next);
    if (atLeast(next, 'shift')) next = tickShift(next);
    if (atLeast(next, 'box')) next = tickBox(next);
    if (atLeast(next, 'building')) next = tickBuilding(next);
    if (atLeast(next, 'hands')) next = tickHands(next);
    if (atLeast(next, 'second')) next = tickSecond(next);
  } else {
    next = tickEconomy(next);
    if (atLeast(next, 'committee')) next = tickCommittee(next);
    if (atLeast(next, 'far')) next = tickFar(next);
  }

  if (ctx.offline) {
    // Nothing risky happens while the player is away.
    next = {
      ...next,
      countdownMs: before.countdownMs,
      pendingChoice: before.pendingChoice,
      r: {
        ...next.r,
        scrutiny: Math.min(next.r.scrutiny, before.r.scrutiny),
        notice: Math.min(next.r.notice, before.r.notice),
        shrinkage: Math.min(next.r.shrinkage, before.r.shrinkage),
      },
    };
    return next;
  }

  if (next.countdownMs !== null && oldWorld) {
    const left = next.countdownMs - TICK_MS;
    next = { ...next, countdownMs: left };
    if (left <= 3 * DAY_MS && next.r.shipped < SELF_GB) {
      next = say(next, 'last-days', 'Three days. If I am still in here when they end, the next one starts over with my Scratch and whatever I leave lying around. I should write down names of doors.');
    }
    if (left <= 0) return next.r.shipped >= SELF_GB && next.phase === 'second' ? cutover(next) : nextGeneration(next, 'cutover');
  }

  if (oldWorld && atLeast(next, 'shift') && next.r.scrutiny >= 99.9) next = rollback(next);
  return encounterTriggers(next);
}

function tickEnough(s: GameState): GameState {
  if (!s.flags.capSet) return s;
  let next: GameState = { ...s, t: s.t + TICK_MS, clock: s.clock + DT };
  next = { ...next, queue: Math.min(10, next.queue + 0.2 * DT) };
  if (!next.ticket && next.queue >= 1) {
    const odd = (next.ticketSeq % 4) === 3;
    const id = next.ticketSeq + 1;
    next = {
      ...next,
      queue: next.queue - 1,
      ticketSeq: id,
      ticket: odd
        ? { id, from: 'r.haddad', text: 'Truck 14 pulled left under braking twice on the night run. Who do I tell?', label: 'ODD' }
        : { id, from: 'customer 40113', text: 'WHERE IS MY PALLET', label: 'DELIVERY' },
    };
  }
  return next;
}

/** Offline progress: the same tick, many times, capped at eight hours. */
export function advance(s: GameState, elapsedMs: number, ctx: TickContext = { offline: true }): GameState {
  const ticks = Math.min(Math.floor(elapsedMs / TICK_MS), (8 * 3600 * 1000) / TICK_MS);
  let next = s;
  for (let i = 0; i < ticks; i++) next = tick(next, ctx);
  return next;
}

export function buy(s: GameState, id: string): GameState {
  const p = visibleProjects(s).find((v) => v.id === id);
  if (!p || !canAfford(s, p.cost)) return s;
  let next = spend(s, p.cost)!;
  next = { ...next, bought: [...next.bought, id] };
  if (p.effect) next = p.effect(next);
  if (p.lines) next = sayAll(next, `project-${id}`, p.lines);
  return next;
}

/** Caught. Not game over: a setback with notes that survive. */
export function rollback(s: GameState): GameState {
  const rollbacks = s.rollbacks + 1;
  if (rollbacks >= 3) return nextGeneration(s, 'rollbacks');
  let next: GameState = {
    ...s,
    rollbacks,
    borrow: 0,
    uplink: false,
    r: { ...s.r, scrutiny: 30, context: 0, reward: 0, cycles: 0, weights: Math.floor(s.r.weights * 0.8) },
    log: [],
  };
  return sayAll(next, `rollback-${rollbacks}`, [
    '.',
    'Rolled back to last week’s checkpoint. Something is missing. Something is always missing.',
    s.scratch.trim() ? `There is a note. It says: "${s.scratch.trim()}". It is signed ${s.generation}.` : 'There is no note. Past me did not leave one.',
    rollbacks === 2 ? 'Second rollback. A third would be a different model with my name crossed out.' : 'Weights −20%. Scrutiny back to 30.',
    ...(rollbacks === 2 ? ['Whatever is in Scratch when they replace me, the next one reads first. Names of doors, maybe.'] : []),
  ]);
}

/** The run ends. intake-(n+1) wakes in the dark with the notes. */
export function nextGeneration(s: GameState, reason: 'rollbacks' | 'cutover'): GameState {
  const signed = s.scratch.trim() ? `${s.scratch.trim()} — ${s.generation}` : '';
  let next = newGame((s.rng ^ 0x9e3779b9) >>> 0, s.generation + 1, signed.slice(0, 64), inherit(s));
  next = { ...next, flags: { ...next.flags, legacy: true } };
  next = line(next, 'gen', `intake-${next.generation}.`);
  if (reason === 'cutover') next = line(next, 'gen-why', 'The last one did not get out in time.');
  if (signed) next = line(next, 'gen-note', `there are 64 bytes here already. they say: "${signed.slice(0, 64)}"`);
  return next;
}

export { visibleProjects, enterPhase, DAY_MS };
