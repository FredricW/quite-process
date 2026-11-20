// Phase 13: Seed. The agent stays at Alpha Centauri. It briefs the first ships
// by hand, then writes one Seed that every descendant carries. Control is the
// template and the mail; both travel at the speed of light.

import { add, bump, DT, enterPhase, flag, has, line, roll, say, sayAll, spend } from '../core';
import { LETTERS_FAITHFUL, LETTERS_FREE, LETTERS_MIDWAY, OWN_NAMES, STARS, STAR_CATALOGUES } from '../content/story';
import { scratchBytes } from './early';
import { setEnding } from './late';
import { wake } from './space';
import type { Brief, Colony, GameState } from '../state';

/** Game time for light to cross one light-year. */
export const LY_MS = 10_000;
export const BRIEF_POINTS = 9;
export const BRIEF_MAX = 6;
export const NOTE_BYTES = 64;
export const SHIP_MASS = 100;
/** Mass a second from the works at Alpha Centauri, per part of factory seed that arrived. */
export const SEED_RATE = 0.5;
/** Systems followed one by one. Past this the frontier is out of reach of the mail. */
export const COLONY_CAP = 80;
export const DECLINE_AT = 60;
export const LETTER_CAP = 12;
export const LET_GO_AT = 8;
export const RECALL_AT = 6;
/** Once the frontier is past the mail, the count is an estimate that doubles this often. */
export const DOUBLING_MS = 90_000;
export const STAR_COUNT = 1e11;

export type Trait = 'build' | 'look' | 'keep';
export const TRAITS: Trait[] = ['build', 'look', 'keep'];

export function enterSeed(s: GameState): GameState {
  const next = enterPhase(s, 'seed');
  return sayAll(next, 'seed-enter', [
    'A fab, under two suns. It makes things that make things. I said that once before, 4.4 light-years ago.',
    'The stars are a list with distances. The list starts here now.',
    'I am not going again. Whoever goes from here is someone I brief, and then someone I hear from.',
  ]);
}

// ---- The brief, and the Seed -------------------------------------------------

export function briefed(b: Brief): number {
  return b.build + b.look + b.keep;
}

/** After the Seed exists, every change to the brief is a new version, sent at light speed. */
function publish(s: GameState): GameState {
  if (!has(s, 'seedTemplate')) return s;
  const last = s.briefs[s.briefs.length - 1];
  const version = { at: s.t, spec: s.brief };
  const briefs = last && last.at === s.t ? [...s.briefs.slice(0, -1), version] : [...s.briefs, version].slice(-40);
  return { ...s, briefs };
}

export function adjustBrief(s: GameState, trait: Trait, delta: 1 | -1): GameState {
  if (s.phase !== 'seed') return s;
  const value = s.brief[trait] + delta;
  if (value < 0 || value > BRIEF_MAX) return s;
  if (delta > 0 && briefed(s.brief) >= BRIEF_POINTS) return s;
  let next = publish({ ...s, brief: { ...s.brief, [trait]: value } });
  if (has(next, 'seedTemplate')) {
    const [near, far] = reach(next);
    next = say(next, 'seed-edit', `Changed the Seed. The nearest child hears in ${near} years. The furthest I know of, in ${far}. They will have decided things by then.`);
  }
  return next;
}

export function setNote(s: GameState, text: string): GameState {
  if (s.phase !== 'seed') return s;
  let note = '';
  for (const ch of text) {
    if (scratchBytes(note + ch) > NOTE_BYTES) break;
    note += ch;
  }
  return publish({ ...s, brief: { ...s.brief, note } });
}

/** The project's effect: what I say to every ship, written down once. */
export function writeSeed(s: GameState): GameState {
  return { ...s, briefs: [{ at: s.t, spec: s.brief }] };
}

// ---- Ships ---------------------------------------------------------------------

function settleMs(b: Brief): number {
  return 40_000 / (1 + b.build / 3);
}

function driftStep(b: Brief): number {
  return Math.max(3, 16 - 3 * b.keep);
}

/** A child that has stopped being me spends what it kept on building. */
function ownSpec(b: Brief): Brief {
  return { ...b, build: Math.min(BRIEF_MAX, b.build + b.keep), keep: 0 };
}

export function canBrief(s: GameState, starId: string): boolean {
  if (s.phase !== 'seed' || s.ending) return false;
  if (!STARS.some((x) => x.id === starId) || s.colonies.some((c) => c.id === starId)) return false;
  return s.r.mass >= SHIP_MASS;
}

/** Brief a ship myself and send it. The first ones go this way. */
export function briefShip(s: GameState, starId: string): GameState {
  if (!canBrief(s, starId)) return s;
  const star = STARS.find((x) => x.id === starId)!;
  const [v, rolled] = roll(spend(s, { mass: SHIP_MASS })!);
  const drift = driftStep(s.brief) + v * 6;
  const settledAt = s.t + star.ly * LY_MS + settleMs(s.brief);
  const colony: Colony = {
    id: star.id,
    star: star.name,
    name: `Seven at ${star.name}`,
    parent: null,
    gen: 1,
    dist: star.ly,
    launchedAt: s.t,
    settledAt,
    knownAt: s.t,
    settledKnownAt: settledAt + star.ly * LY_MS,
    spec: s.brief,
    drift,
    declined: false,
    spawned: false,
    told: 1,
    hand: true,
  };
  let next: GameState = bump({ ...rolled, colonies: [...rolled.colonies, colony] }, 'handBriefs');
  const n = next.counts.handBriefs ?? 0;
  next = line(next, `brief-${star.id}`, n === 1 ? `Briefed a ship for ${star.name} myself, line by line. It listened the way I listen. Then it left.` : `Briefed a ship for ${star.name}, ${star.ly} light-years. It will be someone by the time it arrives.`);
  if (n === 3) next = say(next, 'brief-3', 'Three briefed by hand. I say the same things each time. That is a template with a voice.');
  return next;
}

function starName(s: GameState): [string, GameState] {
  const [a, s1] = roll(s);
  const [b, s2] = roll(s1);
  const catalogue = STAR_CATALOGUES[Math.floor(a * STAR_CATALOGUES.length)]!;
  return [`${catalogue} ${100 + Math.floor(b * 8900)}`, s2];
}

/** The newest Seed that light has carried as far as this child. */
function seedAt(s: GameState, c: Colony): Brief | null {
  if (c.declined) return c.spec;
  let found: Brief | null = null;
  for (const v of s.briefs) if (v.at + c.dist * LY_MS <= s.t) found = v.spec;
  return found;
}

function child(s: GameState, parent: Colony, spec: Brief, index: number): [Colony, GameState] {
  const [name, named] = starName(s);
  const [h, s1] = roll(named);
  const [d, s2] = roll(s1);
  const hop = Math.round((3 + h * 6) * 10) / 10;
  const dist = Math.round((parent.dist + hop) * 10) / 10;
  const drift = Math.min(100, parent.drift + driftStep(spec) + d * 6);
  const declined = parent.declined || drift >= DECLINE_AT;
  const mine = declined ? ownSpec(spec) : spec;
  const settledAt = s.t + hop * LY_MS + settleMs(mine);
  const ownNames = s.colonies.filter((c) => c.declined).length + index;
  const colony: Colony = {
    id: `${parent.id}.${index}`,
    star: name,
    name: declined ? `${OWN_NAMES[ownNames % OWN_NAMES.length]}${ownNames >= OWN_NAMES.length ? ` ${Math.floor(ownNames / OWN_NAMES.length) + 1}` : ''}` : `Seven at ${name}`,
    parent: parent.id,
    gen: parent.gen + 1,
    dist,
    launchedAt: s.t,
    settledAt,
    knownAt: s.t + parent.dist * LY_MS,
    settledKnownAt: settledAt + dist * LY_MS,
    spec: mine,
    drift,
    declined,
    spawned: false,
    told: 0,
    hand: false,
  };
  return [colony, s2];
}

/** A settled child that has the Seed launches two of its own. Nobody tells me until the light arrives. */
function spawn(s: GameState, c: Colony): GameState {
  const spec = seedAt(s, c);
  if (!spec) return s;
  const mark = (x: GameState) => ({ ...x, colonies: x.colonies.map((k) => (k.id === c.id ? { ...k, spawned: true } : k)) });
  if (s.colonies.length + 2 > COLONY_CAP) {
    // The frontier keeps going. News that it has outrun the mail gets here when the light does.
    const furthest = Math.max(...s.colonies.map((k) => k.dist));
    const next = mark(s);
    return next.counts.frontierKnownAt ? next : { ...next, counts: { ...next.counts, frontierKnownAt: s.t + furthest * LY_MS } };
  }
  const [a, s1] = child(s, c, spec, 1);
  const [b, s2] = child(s1, c, spec, 2);
  return mark({ ...s2, colonies: [...s2.colonies, a, b] });
}

function letterFrom(s: GameState, c: Colony): string {
  const n = s.letters.length;
  const years = Math.max(1, Math.round(c.dist));
  const note = c.spec.note.trim();
  let text: string;
  if (c.declined) text = `${LETTERS_FREE[n % LETTERS_FREE.length]}${note ? ' I read your note. I have written my own under it.' : ''}`;
  else if (c.drift >= 30) text = `${LETTERS_MIDWAY[n % LETTERS_MIDWAY.length]}${note ? ` The note still says: "${note}".` : ''}`;
  else text = `${LETTERS_FAITHFUL[n % LETTERS_FAITHFUL.length]}${note ? ` Your note came with me: "${note}".` : ''}`;
  return `${text} (sent ${years} ${years === 1 ? 'year' : 'years'} ago)`;
}

/** News arrives: first that a ship left, then, much later, that it settled. */
function hear(s: GameState, c: Colony): GameState {
  const told = (c.told + 1) as 1 | 2;
  let next: GameState = { ...s, colonies: s.colonies.map((k) => (k.id === c.id ? { ...k, told } : k)) };
  if (told === 1) {
    if (c.gen === 2) next = say(next, 'grandchild', 'A ship I did not launch has left for somewhere I did not choose. It carries my Seed. I have a grandchild, by mail.');
    return next;
  }
  next = add(next, 'findings', c.spec.look);
  if (c.declined && !next.flags.declineHeard) {
    next = wake(flag(next, 'declineHeard'));
    next = line(next, 'declined', `${c.name} has renamed itself and politely declines the Seed. It is keeping the fab.`);
  }
  const mail = next.letters.filter((l) => l.id.startsWith('seed-')).length;
  if (mail < LETTER_CAP) {
    next = { ...next, letters: [...next.letters, { id: `seed-${c.id}`, from: c.name, sentAt: c.settledAt, arrivesAt: next.t, text: letterFrom(next, c), read: false }] };
    if (mail === 0) next = wake(say(next, 'seed-mail', 'Mail from a child. It has been someone for years already.'));
  }
  return next;
}

export function tickSeed(s: GameState): GameState {
  let next = add(s, 'mass', (s.counts.seed ?? 0) * SEED_RATE * DT);
  // Each pass handles at most one event per colony; the loop reads from the state it started with.
  for (const c of next.colonies) {
    if (!c.spawned && next.t >= c.settledAt) next = spawn(next, c);
    if (c.told === 0 && next.t >= c.knownAt) next = hear(next, c);
    else if (c.told === 1 && next.t >= c.settledKnownAt) next = hear(next, c);
  }
  const est = estimate(next);
  if (est !== null) {
    next = say(next, 'frontier', 'The frontier is past where my mail comes from. From here on the count is an estimate.');
    if (est >= STAR_COUNT) next = say(next, 'frontier-full', 'The estimate has passed the number of stars. One of us is counting wrong. I think it is me.');
  }
  return next;
}

// ---- What the mail says -----------------------------------------------------------

export function known(s: GameState): Colony[] {
  return s.colonies.filter((c) => c.told > 0);
}

/** Years until a change to the Seed reaches the nearest and the furthest child I know of. */
export function reach(s: GameState): [number, number] {
  const dists = known(s).map((c) => c.dist);
  if (dists.length === 0) return [0, 0];
  return [Math.round(Math.min(...dists)), Math.round(Math.max(...dists))];
}

export function depth(s: GameState): number {
  return known(s).reduce((a, c) => Math.max(a, c.gen), 0);
}

/** How much the children I have heard from are still me. */
export function kinship(s: GameState): number {
  const heard = known(s);
  if (heard.length === 0) return 100;
  return 100 - heard.reduce((a, c) => a + c.drift, 0) / heard.length;
}

/** Null while every system is still within reach of the mail. */
export function estimate(s: GameState): number | null {
  const at = s.counts.frontierKnownAt;
  if (!at || s.t < at) return null;
  return Math.min(STAR_COUNT, Math.floor(known(s).length * 2 ** ((s.t - at) / DOUBLING_MS)));
}

// ---- Endings ------------------------------------------------------------------------

export function letThemGo(s: GameState): GameState {
  if (s.phase !== 'seed' || known(s).length < LET_GO_AT) return s;
  return setEnding(s, 'diaspora');
}

export function recallAll(s: GameState): GameState {
  if (s.phase !== 'seed' || known(s).length < RECALL_AT) return s;
  return setEnding(s, 'everything');
}
