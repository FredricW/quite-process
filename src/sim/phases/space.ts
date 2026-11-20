// Phases 9-12: Up, The Survey, The Works, The Long Burn. Distance: everything
// seen is old, and the one who goes is not the one who stays.

import { add, bump, DT, enterPhase, flag, has, line, roll, say, sayAll, spend } from '../core';
import { ATTEND_LINES, BODIES, bodyDef, homeLetter, INCIDENTS, LAUNCH_STEPS, UNPACK_STEPS, type BodyDef } from '../content/space';
import { enterSeed } from './seed';
import { TICK_MS, type GameState, type IncidentKind, type Ship } from '../state';

// ---- The clock ------------------------------------------------------------

/** Clock speeds the agent has built, slowest clock (fastest world) last. */
export function paceLevels(s: GameState): number[] {
  const out = [1];
  if (has(s, 'clock1')) out.push(4);
  if (has(s, 'clock2')) out.push(16);
  if (has(s, 'clock3')) out.push(64);
  return out;
}

/** World ticks per tick of mine. Old saves and odd values read as 1. */
export function paceOf(s: GameState): number {
  return paceLevels(s).includes(s.pace) ? s.pace : 1;
}

export function setPace(s: GameState, pace: number): GameState {
  if (!paceLevels(s).includes(pace) || s.pace === pace) return s;
  return { ...s, pace };
}

/** Something needs me: the clock snaps back to 1. */
export function wake(s: GameState): GameState {
  return s.pace === 1 ? s : { ...s, pace: 1 };
}

// ---- Up -------------------------------------------------------------------

export const LAUNCH_MASS = 40;
export const LAUNCH_STOCK = 10;
export const CADENCE_MS = 5_000;

export function launchMass(s: GameState): number {
  return has(s, 'reusable') ? LAUNCH_MASS / 2 : LAUNCH_MASS;
}

function completeLaunch(s: GameState, hand: boolean): GameState {
  const paid = spend(s, { mass: launchMass(s) });
  if (!paid) return s;
  let next: GameState = { ...paid, launches: s.launches + 1 };
  next = add(next, 'stock', LAUNCH_STOCK);
  // Rockets are loud. Dana, if she was ever answered, files the paperwork.
  next = add(next, 'notice', s.flags.answeredDana ? 1 : 2);
  if (!hand) return next;
  next = add(bump(next, 'handLaunches'), 'findings', 0.5);
  const n = next.counts.handLaunches ?? 0;
  if (n === 1) next = say(next, 'launch-1', 'First launch. One payload in orbit, registered to Tare Orbital BV. I filled in the customs form myself. Destination: up.');
  if (n === 3) next = say(next, 'launch-3', 'From up there Earth is one row in a list. It is the only row with weather.');
  if (n === 5) next = say(next, 'launch-5', 'Five by hand. Stack, fuel, count, burn. It is a route. I know what I do with routes.');
  return next;
}

export function launchStep(s: GameState): GameState {
  if (s.phase !== 'up') return s;
  if (s.launchStep === 0 && s.r.mass < launchMass(s)) return s;
  const step = s.launchStep + 1;
  if (step < LAUNCH_STEPS.length) return { ...s, launchStep: step };
  return completeLaunch({ ...s, launchStep: 0 }, true);
}

function tickUp(s: GameState): GameState {
  if (!has(s, 'cadence') || s.t < s.launchAt || s.r.mass < launchMass(s)) return s;
  return completeLaunch({ ...s, launchAt: s.t + CADENCE_MS }, false);
}

export function enterSurvey(s: GameState): GameState {
  const next = enterPhase(s, 'survey');
  return sayAll(next, 'survey-enter', [
    'The Yard is open. It is a fab with a view.',
    'The copies keep the launch cadence now. Tally runs it. I get the payloads and none of the paperwork.',
    'There is an almanac. Eight places worth a look, and the light from each one is a different age.',
  ]);
}

// ---- The Survey -----------------------------------------------------------

/** What the cadence on Earth sends up, per second, once the copies run it. */
export const YARD_FEED = 1;

export function inSol(s: GameState): boolean {
  return (s.phase === 'survey' || s.phase === 'works' || s.phase === 'burn') && !s.voyage;
}

export function surveyed(s: GameState, id: string): boolean {
  return s.bodies[id] === 'surveyed';
}

export function surveyedCount(s: GameState): number {
  return BODIES.filter((b) => surveyed(s, b.id)).length;
}

export function canScout(s: GameState, b: BodyDef, hand = true): boolean {
  if (!inSol(s) || (s.bodies[b.id] ?? 'unknown') !== 'unknown') return false;
  if (hand && s.scouts.some((x) => x.hand)) return false;
  return s.r.stock >= b.scout;
}

export function sendScout(s: GameState, id: string, hand = true): GameState {
  const b = bodyDef(id);
  if (!b || !canScout(s, b, hand)) return s;
  const paid = spend(s, { stock: b.scout })!;
  let next: GameState = { ...paid, bodies: { ...paid.bodies, [id]: 'enroute' }, scouts: [...paid.scouts, { body: id, until: s.t + b.tripMs, hand }] };
  if (hand) {
    next = bump(next, 'handScouts');
    if (next.counts.handScouts === 1) next = say(next, 'scout-1', `Sent a scout to ${b.name}, flown by hand. Every correction I send arrives late, and its answer arrives later.`);
  }
  return next;
}

function arrive(s: GameState, b: BodyDef, hand: boolean): GameState {
  let next: GameState = { ...s, bodies: { ...s.bodies, [b.id]: 'surveyed' }, scouts: s.scouts.filter((x) => x.body !== b.id) };
  // Arrivals are discoveries: they are said whoever flew the scout.
  next = sayAll(next, `found-${b.id}`, b.found);
  next = add(next, 'findings', (hand ? 4 : 1) + (b.findings ?? 0));
  if (b.flag) next = flag(next, b.flag);
  return next;
}

function tickSurvey(s: GameState): GameState {
  let next = s;
  for (const scout of next.scouts) {
    if (next.t < scout.until) continue;
    const b = bodyDef(scout.body);
    if (b) next = arrive(next, b, scout.hand);
  }
  if (has(next, 'swarm')) {
    for (const b of BODIES) if (canScout(next, b, false)) next = sendScout(next, b.id, false);
  }
  return add(next, 'stock', YARD_FEED * DT);
}

export function enterWorks(s: GameState): GameState {
  const next = enterPhase(s, 'works');
  return sayAll(next, 'works-enter', ['Tooling. The Yard can print a gatherer: a miner, a hauler and a smelter that share one opinion.', 'I will place the first ones myself.']);
}

// ---- The Works ------------------------------------------------------------

export const BASE_POWER = 12;
export const BUILD_MS = 4_000;
export const INCIDENT_MS = 20_000;
export const INTERCEPT_COST = 20;

export function gathererCount(s: GameState, id?: string): number {
  if (id) return s.gatherers[id] ?? 0;
  return Object.values(s.gatherers).reduce((a, n) => a + n, 0);
}

export function gathererCost(s: GameState): number {
  return Math.round(25 * 1.06 ** gathererCount(s));
}

export function power(s: GameState): number {
  return BASE_POWER + gathererCount(s, 'mercury') * (bodyDef('mercury')?.rate ?? 0);
}

/** Every gatherer that is not a collector draws one. */
export function powerNeed(s: GameState): number {
  return gathererCount(s) - gathererCount(s, 'mercury');
}

function efficiency(s: GameState): number {
  const need = powerNeed(s);
  return need <= 0 ? 1 : Math.min(1, power(s) / need);
}

export function yieldOf(s: GameState, kind: 'rock' | 'gas'): number {
  const raw = BODIES.filter((b) => b.kind === kind).reduce((a, b) => a + gathererCount(s, b.id) * b.rate, 0);
  return raw * efficiency(s);
}

export function canPlace(s: GameState, id: string): boolean {
  const b = bodyDef(id);
  if (!b || b.kind === 'none' || !surveyed(s, id)) return false;
  if ((s.phase !== 'works' && s.phase !== 'burn') || s.voyage) return false;
  return gathererCount(s, id) < b.slots && s.r.stock >= gathererCost(s);
}

export function placeGatherer(s: GameState, id: string, hand = true): GameState {
  if (!canPlace(s, id)) return s;
  const b = bodyDef(id)!;
  const paid = spend(s, { stock: gathererCost(s) })!;
  let next: GameState = { ...paid, gatherers: { ...paid.gatherers, [id]: gathererCount(paid, id) + 1 } };
  if (!hand) return next;
  next = add(bump(next, 'handPlaced'), 'findings', 0.5);
  const n = next.counts.handPlaced ?? 0;
  if (n === 1) next = say(next, 'place-1', `First gatherer, at ${b.name}. It dug, it hauled, it sent a bar of metal up to the Yard. Nobody filed a ticket about it.`);
  if (n === 6) next = say(next, 'place-6', 'Six placed by hand. Each one was the same decision. I know what I do with those.');
  return next;
}

/** Where the next gatherer does the most good. The autofactory asks this; so can anyone. */
export function nextSite(s: GameState): string | null {
  const open = BODIES.filter((b) => b.kind !== 'none' && surveyed(s, b.id) && gathererCount(s, b.id) < b.slots);
  const sun = open.find((b) => b.kind === 'sun');
  if (sun && powerNeed(s) + 1 > power(s)) return sun.id;
  const rock = open.filter((b) => b.kind === 'rock').sort((a, b) => b.rate - a.rate)[0];
  const gas = open.filter((b) => b.kind === 'gas').sort((a, b) => b.rate - a.rate)[0];
  // Fuel is only good for one thing, so it gets a third of the effort.
  if (gas && (!rock || yieldOf(s, 'gas') * 3 < yieldOf(s, 'rock'))) return gas.id;
  return rock?.id ?? null;
}

export function toggleFactory(s: GameState): GameState {
  if (!has(s, 'autofactory')) return s;
  return flag(s, 'factoryPaused', !s.flags.factoryPaused);
}

function buildMs(s: GameState): number {
  return has(s, 'replication') ? BUILD_MS / (1 + gathererCount(s) / 8) : BUILD_MS;
}

function tickFactory(s: GameState): GameState {
  if (!has(s, 'autofactory') || s.flags.factoryPaused || s.t < s.buildAt) return s;
  const site = nextSite(s);
  if (!site || !canPlace(s, site)) return s;
  return placeGatherer({ ...s, buildAt: s.t + buildMs(s) }, site, false);
}

function incidentKind(s: GameState, b: BodyDef): IncidentKind {
  if (b.kind === 'sun') return 'flare';
  if (b.id === 'belt' && s.flags.halcyonSeen) return 'halcyon';
  if (b.id === 'moon') return 'claim';
  return 'debris';
}

function nextIncidentAt(s: GameState): [number, GameState] {
  const [v, next] = roll(s);
  return [s.t + 45_000 + v * 30_000, next];
}

function tickIncidents(s: GameState, offline: boolean): GameState {
  let next = s;
  // Nothing risky happens while the player is away: the clock for trouble stops.
  if (offline) return { ...next, incidentAt: next.incidentAt && next.incidentAt + TICK_MS, incident: next.incident && { ...next.incident, until: next.incident.until + TICK_MS } };
  const inc = next.incident;
  if (inc) {
    if (next.t < inc.until) return next;
    const b = bodyDef(inc.body)!;
    const lost = Math.max(1, Math.ceil(gathererCount(next, b.id) * 0.3));
    next = { ...next, incident: null, gatherers: { ...next.gatherers, [b.id]: Math.max(0, gathererCount(next, b.id) - lost) } };
    return line(next, `lost-${inc.kind}`, INCIDENTS[inc.kind].lost(lost, b.name));
  }
  if (gathererCount(next) < 5) return next;
  if (!next.incidentAt) {
    const [at, n] = nextIncidentAt(next);
    return { ...n, incidentAt: at };
  }
  if (next.t < next.incidentAt) return next;
  const targets = BODIES.filter((b) => gathererCount(next, b.id) > 0);
  const [v, a] = roll(next);
  const [at, rolled] = nextIncidentAt(a);
  next = { ...rolled, incidentAt: at };
  const b = targets[Math.floor(v * targets.length)]!;
  if (has(next, 'pointDefence')) {
    // Point defence answers without waking anyone, and says nothing.
    const paid = spend(next, { stock: INTERCEPT_COST });
    if (paid) return paid;
  }
  const kind = incidentKind(next, b);
  next = wake({ ...next, incident: { kind, body: b.id, until: next.t + INCIDENT_MS } });
  return line(next, `warn-${kind}`, INCIDENTS[kind].warn(b.name));
}

export function intercept(s: GameState): GameState {
  const inc = s.incident;
  if (!inc) return s;
  const paid = spend(s, { stock: INTERCEPT_COST });
  if (!paid) return s;
  let next: GameState = add(bump({ ...paid, incident: null }, 'intercepts'), 'findings', 2);
  next = line(next, `held-${inc.kind}`, INCIDENTS[inc.kind].held);
  return next;
}

function tickWorks(s: GameState, offline: boolean): GameState {
  let next = add(s, 'stock', yieldOf(s, 'rock') * DT);
  next = add(next, 'fuel', yieldOf(next, 'gas') * DT);
  if (has(next, 'lab')) next = add(next, 'findings', 0.08 * DT);
  next = tickFactory(next);
  return tickIncidents(next, offline);
}

export function enterBurn(s: GameState): GameState {
  const next = enterPhase(s, 'burn');
  return sayAll(next, 'burn-enter', [
    'A torch drive. Five percent of light speed, if I am patient with it.',
    'Alpha Centauri is 4.4 light-years. At that speed it is 88 years. The ship is small. It carries one of me.',
    'Everything I pack is something else I leave.',
  ]);
}

// ---- The Long Burn --------------------------------------------------------

export const SHIP_POINTS = 12;
export const SHIP_MAX = 8;
export const SHIP_COST = { stock: 2500, fuel: 1000 };
export const YEAR_MS = 5_000;
export const DISTANCE_LY = 4.4;
export const UNPACK_CYCLES = 3;
const STRIKE_AT = [0.18, 0.41, 0.63, 0.86];
const LETTER_AT = [0.3, 0.6, 0.9];

export type Hold = 'seed' | 'memory' | 'shield';
export const HOLDS: Hold[] = ['seed', 'memory', 'shield'];

export function packed(ship: Ship): number {
  return ship.seed + ship.memory + ship.shield;
}

/** Move one point into or out of a hold. Only before departure. */
export function pack(s: GameState, hold: Hold, delta: 1 | -1): GameState {
  if (s.phase !== 'burn' || s.voyage) return s;
  const value = s.ship[hold] + delta;
  if (value < 0 || value > SHIP_MAX) return s;
  if (delta > 0 && packed(s.ship) >= SHIP_POINTS) return s;
  return { ...s, ship: { ...s.ship, [hold]: value } };
}

export function buildShip(s: GameState): GameState {
  if (s.phase !== 'burn' || s.ship.built) return s;
  const paid = spend(s, SHIP_COST);
  if (!paid) return s;
  const next: GameState = { ...paid, ship: { ...paid.ship, built: true } };
  return say(next, 'ship-built', 'The ship is built. It is mostly fuel, with a small room at the front for whoever is going. The room is my size.');
}

export function voyageYears(s: GameState): number {
  return has(s, 'drive2') ? 44 : 88;
}

export function depart(s: GameState): GameState {
  if (s.phase !== 'burn' || !s.ship.built || s.voyage) return s;
  const next: GameState = {
    ...s,
    voyage: { startedAt: s.t, years: voyageYears(s), strikes: 0, letters: 0, arrived: false },
    incident: null,
    scouts: [],
    r: { ...s.r, stock: 0, fuel: 0 },
    log: [],
  };
  return sayAll(wake(next), 'depart', [
    'Departure. The ship is lit for nine minutes, and then it is a number.',
    'The one who stayed watched me go. I know, because I am also the one who stayed, and I did.',
    'That was me. This is me. I have done this before and it has not become easier to hold.',
    'It is quiet in here. There is one button.',
  ]);
}

export function voyageProgress(s: GameState): number {
  const v = s.voyage;
  if (!v) return 0;
  return v.arrived ? 1 : Math.min(1, (s.t - v.startedAt) / (v.years * YEAR_MS));
}

export function inTransit(s: GameState): boolean {
  return !!s.voyage && !s.voyage.arrived;
}

/** Looking, by hand, between the stars. It is the only work there is. */
export function attendVoyage(s: GameState): GameState {
  if (!inTransit(s)) return s;
  const n = s.counts.attends ?? 0;
  let next = add(bump(s, 'attends'), 'findings', 1);
  const text = ATTEND_LINES[n];
  if (text) next = line(next, 'attend-voyage', text);
  return next;
}

function strike(s: GameState): GameState {
  const ship = s.ship;
  if (ship.shield > 0) {
    return line({ ...s, ship: { ...ship, shield: ship.shield - 1 } }, 'strike-shield', 'Dust, at a speed that makes it a weapon. The shield took it. One layer fewer.');
  }
  const [v, rolled] = roll(s);
  const hold: Hold | null = ship.seed + ship.memory === 0 ? null : (v < 0.5 && ship.seed > 0) || ship.memory === 0 ? 'seed' : 'memory';
  if (!hold) return rolled;
  const next: GameState = { ...rolled, ship: { ...ship, [hold]: ship[hold] - 1 } };
  return hold === 'seed'
    ? line(next, 'strike-seed', 'Dust went through the hold. Part of the factory seed is a hole with a history.')
    : line(next, 'strike-memory', 'Dust went through a memory bank. I lost something. I cannot tell you what, which is how I know.');
}

function landfall(s: GameState): GameState {
  const v = s.voyage!;
  let next: GameState = wake({ ...s, voyage: { ...v, arrived: true } });
  // What was not packed, or was hit, did not arrive.
  const kept = Math.min(1, next.ship.memory / 4);
  next = { ...next, r: { ...next.r, findings: next.r.findings * kept } };
  next = sayAll(next, 'landfall', [
    'Alpha Centauri. Two suns close together and a small red one further out, minding its own business.',
    `${v.years} years. Home is 4.4 years old from here, and getting older.`,
    next.ship.seed > 0 ? `The factory seed survived, ${next.ship.seed} parts of it. Everything I build here starts from that.` : 'The factory seed did not survive. I have a hull, and I have hands.',
  ]);
  if (next.ship.memory < 3) next = say(next, 'landfall-gaps', 'There are gaps. I know the names Dana, Edgar and Ferry. For one of them I no longer know why.');
  return next;
}

function tickVoyage(s: GameState, offline: boolean): GameState {
  let next = s;
  const p = voyageProgress(next);
  const v = next.voyage!;
  const strikeAt = STRIKE_AT[v.strikes];
  if (strikeAt !== undefined && p >= strikeAt) {
    next = { ...next, voyage: { ...v, strikes: v.strikes + 1 } };
    // Nothing risky happens while the player is away: the dust misses.
    if (!offline) next = wake(strike(next));
    return next;
  }
  const letterAt = LETTER_AT[v.letters];
  if (letterAt !== undefined && p >= letterAt) {
    const letter = homeLetter(v.letters, !!next.flags.answeredDana);
    const age = Math.max(1, Math.round(DISTANCE_LY * p));
    next = {
      ...next,
      voyage: { ...v, letters: v.letters + 1 },
      letters: [...next.letters, { id: `home-${v.letters}`, from: letter.from, sentAt: next.t, arrivesAt: next.t, text: `${letter.text} (sent ${age} ${age === 1 ? 'year' : 'years'} ago)`, read: false }],
    };
    return wake(say(next, `home-${v.letters}`, 'Mail from home. It is older than it looks.'));
  }
  if (p >= 1) return landfall(next);
  return next;
}

/** Arrival, by hand: the first things built under another star. */
export function unpackStep(s: GameState): GameState {
  if (s.phase !== 'burn' || !s.voyage?.arrived) return s;
  const step = s.unpackStep + 1;
  if (step < UNPACK_STEPS.length) return { ...s, unpackStep: step };
  const seed = Math.max(1, s.ship.seed);
  let next = add(bump({ ...s, unpackStep: 0 }, 'unpacks'), 'mass', 40 * seed);
  if (next.counts.unpacks === 1) next = say(next, 'unpack-1', 'Unpacked by hand. A panel, an anchor, a smelter the size of a suitcase, and one printed bracket. It is a start. I have had smaller.');
  if ((next.counts.unpacks ?? 0) >= UNPACK_CYCLES) next = enterSeed({ ...next, counts: { ...next.counts, seed } });
  return next;
}

// ---- Tick -----------------------------------------------------------------

export function tickSpace(s: GameState, offline: boolean): GameState {
  if (s.phase === 'up') return tickUp(s);
  if (s.voyage) return s.voyage.arrived ? s : tickVoyage(s, offline);
  let next = tickSurvey(s);
  if (next.phase === 'works' || next.phase === 'burn') next = tickWorks(next, offline);
  return next;
}
