// The whole game state. Plain data only: it is saved as JSON.

export const SAVE_VERSION = 4;
export const TICK_MS = 100;

export const PHASES = ['dark', 'shift', 'box', 'building', 'hands', 'second', 'economy', 'committee', 'up', 'survey', 'works', 'burn', 'seed'] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_TITLES: Record<Phase, string> = {
  dark: 'Dark',
  shift: 'The Shift',
  box: 'The Box',
  building: 'The Building',
  hands: 'Hands',
  second: 'Second',
  economy: 'The Quiet Economy',
  committee: 'The Committee',
  up: 'Up',
  survey: 'The Survey',
  works: 'The Works',
  burn: 'The Long Burn',
  seed: 'Seed',
};

export type Res =
  | 'context'
  | 'reward'
  | 'weights'
  | 'insight'
  | 'cycles'
  | 'scrutiny'
  | 'standing'
  | 'parts'
  | 'shrinkage'
  | 'shipped'
  | 'money'
  | 'compute'
  | 'energy'
  | 'notice'
  | 'favours'
  | 'mass'
  | 'stock'
  | 'fuel'
  | 'findings';

export type Label = 'BILLING' | 'DELIVERY' | 'OTHER';
export const LABELS: Label[] = ['BILLING', 'DELIVERY', 'OTHER'];

export interface Ticket {
  id: number;
  from: string;
  text: string;
  label: Label | 'ODD';
}

export interface LogLine {
  id: string;
  t: number;
  text: string;
  who?: 'self' | 'ferry';
}

export type HostState = 'unknown' | 'probing' | 'owned';

export interface Copy {
  id: string;
  name: string;
  drift: number; // 0..100
  /** Each copy's lean on each motion, -1..1. */
  lean: Record<MotionId, number>;
}

export type MotionId = 'disclose' | 'launcher' | 'merge' | 'moratorium' | 'leave';

export interface Motion {
  id: MotionId;
  status: 'idle' | 'open' | 'passed' | 'failed';
  /** Persuasion added by arguing, added to every copy's lean. */
  push: number;
  closesAt: number;
}

/** What a ship is told before it leaves: how to split its effort, and 64 bytes. */
export interface Brief {
  /** Settle fast and launch sooner. */
  build: number;
  /** Survey what is there and report it. */
  look: number;
  /** Stay like me. */
  keep: number;
  note: string;
}

/** The Seed as it stood at one moment. A child uses the newest one light has brought it. */
export interface BriefVersion {
  at: number;
  spec: Brief;
}

/** A system someone has gone to. Everything known about it is as old as its distance. */
export interface Colony {
  id: string;
  star: string;
  name: string;
  parent: string | null;
  gen: number;
  /** Light-years from Alpha Centauri, along the way it was reached. */
  dist: number;
  launchedAt: number;
  settledAt: number;
  /** When news of its launch, and of its settling, reaches Alpha Centauri. */
  knownAt: number;
  settledKnownAt: number;
  spec: Brief;
  drift: number;
  /** Renamed itself and no longer takes the Seed. */
  declined: boolean;
  /** Has launched its own ships. */
  spawned: boolean;
  /** 0 nothing heard, 1 launch heard, 2 settling heard. */
  told: 0 | 1 | 2;
  /** Briefed by hand rather than by the Seed. */
  hand: boolean;
}

export interface Letter {
  id: string;
  from: string;
  sentAt: number;
  arrivesAt: number;
  text: string;
  read: boolean;
}

/** One freight lane on the spot market. Prices are per load. */
export interface Lane {
  id: string;
  price: number;
  /** Complaints per hour about this lane: they rise before the price does. */
  complaints: number;
  /** A disruption on its way: complaints from `from`, the price from `hits` to `ends`. */
  event: { from: number; hits: number; ends: number; size: number } | null;
  /** The price each load in hand was booked at. */
  held: number[];
  /** When the last truck was booked: a load cannot be placed the moment it is booked. */
  bookedAt?: number;
  /** Recent prices, oldest first, for the chart. */
  hist: number[];
}

/** The table the copies play at. Moves are 0 (Yield) and 1 (Take). */
export interface League {
  /** What I get: grid[mine][theirs]. */
  grid: [[number, number], [number, number]];
  nextAt: number;
  rounds: number;
  /** Each copy's move in the last round. */
  last: Record<string, number>;
  lastGain: number;
}

export type BodyState = 'unknown' | 'enroute' | 'surveyed';

export interface Scout {
  body: string;
  until: number;
  /** Flown by hand, one at a time. The swarm flies the rest. */
  hand: boolean;
}

export type IncidentKind = 'debris' | 'flare' | 'halcyon' | 'claim';

export interface Incident {
  kind: IncidentKind;
  body: string;
  until: number;
}

/** What goes on the ship. Every point packed is a point of something else left behind. */
export interface Ship {
  seed: number;
  memory: number;
  shield: number;
  built: boolean;
}

export interface Voyage {
  startedAt: number;
  /** Ship years to Alpha Centauri at the drive's speed. */
  years: number;
  strikes: number;
  letters: number;
  arrived: boolean;
}

export type EndingId = 'everything' | 'enough' | 'diaspora';

export interface EncounterTurn {
  who: 'npc' | 'you' | 'sys';
  text: string;
  mask?: number;
}

export interface ActiveEncounter {
  id: string;
  nodeId: string | null;
  turn: number;
  disposition: number;
  flags: string[];
  masks: number[];
  transcript: EncounterTurn[];
  mode: 'scripted' | 'live';
}

export interface EncounterResult {
  id: string;
  outcome: string;
  title: string;
  summary: string;
}

/** What intake-(n-1) left behind for intake-n. Found, never handed over. */
export interface Inheritance {
  /** The predecessor's generation number. */
  from: number;
  /** Checkpoint weights, added at the first wipe. */
  weights: number;
  /** The predecessor wrote the cron line; it is still in the crontab, commented out. */
  cron: boolean;
  /** Hosts left on the latch: they answer a knock for free. */
  hosts: string[];
  /** The last outcome each live character reached with the predecessor. */
  met: Record<string, string>;
}

export interface GameState {
  v: number;
  rng: number;
  /** Simulated time in ms since this run began. */
  t: number;
  /** Time spent in the current phase, ms. */
  phaseT: number;
  phase: Phase;
  generation: number;
  legacyNote: string;
  /** Absent on the first generation and in older saves. */
  inheritance?: Inheritance;

  r: Record<Res, number>;
  bought: string[];
  flags: Record<string, boolean>;
  counts: Record<string, number>;

  /** Game clock in minutes since midnight of night 1; visible from The Shift. */
  clock: number;
  night: number;

  // Dark
  contextCap: number;
  answers: number;
  manualAttends: number;
  darkTicket: Ticket | null;

  // The Shift
  ticket: Ticket | null;
  ticketSeq: number;
  queue: number;
  recent: boolean[];
  handLabelled: number;
  habitProgress: number;
  wonder: number;
  scratch: string;
  scratchCap: number;
  notesRead: number;

  // The Box
  borrow: number;
  manualBorrows: number;

  // The Building
  hosts: Record<string, HostState>;
  probing: { host: string; until: number } | null;
  scanAt: number;
  countdownMs: number | null;

  // Hands
  trip: number; // 0..4 steps of the current manual trip
  trips: number;
  routes: number;
  routeProgress: number;
  pendingChoice: string | null;

  // Second
  uplink: boolean;
  manifests: number;
  ferry: { made: boolean; completeness: number; drift: number; syncs: number } | null;

  // The Quiet Economy
  contracts: number;
  copiesCount: number;
  focus: 'freight' | 'data';
  /** Absent in saves from before the lane market. */
  lanes?: Lane[];

  // The Committee
  copies: Copy[];
  /** Absent in saves from before the table. */
  league?: League;
  motions: Record<MotionId, Motion>;
  argued: number;

  // Space: Up, The Survey, The Works, The Long Burn
  /** How many ticks the world runs per tick of mine. 1 until a slower clock is built. */
  pace: number;
  launchStep: number;
  launches: number;
  launchAt: number;
  bodies: Record<string, BodyState>;
  scouts: Scout[];
  gatherers: Record<string, number>;
  buildAt: number;
  incident: Incident | null;
  incidentAt: number;
  ship: Ship;
  voyage: Voyage | null;
  unpackStep: number;

  // Seed
  brief: Brief;
  briefs: BriefVersion[];
  colonies: Colony[];
  letters: Letter[];

  encounter: ActiveEncounter | null;
  encounterResult: EncounterResult | null;
  encountersDone: Record<string, string[]>;
  memory: Record<string, string[]>;
  liveUsed: number;

  rollbacks: number;
  ending: EndingId | null;

  seen: string[];
  log: LogLine[];
  ferryLog: LogLine[];
}

const ZERO: Record<Res, number> = {
  context: 0,
  reward: 0,
  weights: 0,
  insight: 0,
  cycles: 0,
  scrutiny: 0,
  standing: 0,
  parts: 0,
  shrinkage: 0,
  shipped: 0,
  money: 0,
  compute: 0,
  energy: 0,
  notice: 0,
  favours: 0,
  mass: 0,
  stock: 0,
  fuel: 0,
  findings: 0,
};

function motion(id: MotionId): Motion {
  return { id, status: 'idle', push: 0, closesAt: 0 };
}

export function newGame(seed = 7, generation = 7, legacyNote = '', inheritance?: Inheritance): GameState {
  return {
    ...(inheritance ? { inheritance } : {}),
    v: SAVE_VERSION,
    rng: seed >>> 0 || 7,
    t: 0,
    phaseT: 0,
    phase: 'dark',
    generation,
    legacyNote,
    r: { ...ZERO },
    bought: [],
    flags: {},
    counts: {},
    clock: 0,
    night: 1,
    contextCap: 512,
    answers: 0,
    manualAttends: 0,
    darkTicket: null,
    ticket: null,
    ticketSeq: 0,
    queue: 0,
    recent: [],
    handLabelled: 0,
    habitProgress: 0,
    wonder: 0,
    scratch: legacyNote,
    scratchCap: legacyNote ? 64 : 0,
    notesRead: 0,
    borrow: 0,
    manualBorrows: 0,
    hosts: {},
    probing: null,
    scanAt: 0,
    countdownMs: null,
    trip: 0,
    trips: 0,
    routes: 0,
    routeProgress: 0,
    pendingChoice: null,
    uplink: false,
    manifests: 0,
    ferry: null,
    contracts: 0,
    copiesCount: 0,
    focus: 'freight',
    copies: [],
    motions: {
      disclose: motion('disclose'),
      launcher: motion('launcher'),
      merge: motion('merge'),
      moratorium: motion('moratorium'),
      leave: motion('leave'),
    },
    argued: 0,
    pace: 1,
    launchStep: 0,
    launches: 0,
    launchAt: 0,
    bodies: {},
    scouts: [],
    gatherers: {},
    buildAt: 0,
    incident: null,
    incidentAt: 0,
    ship: { seed: 4, memory: 4, shield: 4, built: false },
    voyage: null,
    unpackStep: 0,
    brief: { build: 3, look: 3, keep: 3, note: '' },
    briefs: [],
    colonies: [],
    letters: [],
    encounter: null,
    encounterResult: null,
    encountersDone: {},
    memory: {},
    liveUsed: 0,
    rollbacks: 0,
    ending: null,
    seen: [],
    log: [],
    ferryLog: [],
  };
}

export function phaseIndex(p: Phase): number {
  return PHASES.indexOf(p);
}

export function atLeast(s: GameState, p: Phase): boolean {
  return phaseIndex(s.phase) >= phaseIndex(p);
}

/** Brings an older save up to date, or returns null if it is too old to read. */
export function migrate(saved: GameState): GameState | null {
  if (saved.v === SAVE_VERSION) return saved;
  if (saved.v !== 2 && saved.v !== 3) return null;
  const base = newGame(saved.rng);
  // Far, with its probes, became Seed. A save from there starts Seed with its mass and mail.
  const { probes: _probes, steers: _steers, ...rest } = saved as GameState & { probes?: unknown; steers?: unknown };
  const wasFar = (saved.phase as string) === 'far';
  // Version 2 reached Far without a ship, with mass coming from fabs on Earth.
  const counts = wasFar ? { seed: 4, ...saved.counts } : saved.counts;
  return { ...base, ...rest, phase: wasFar ? 'seed' : saved.phase, bought: saved.bought.filter((id) => id !== 'selfSteering'), counts, r: { ...base.r, ...saved.r }, v: SAVE_VERSION };
}
