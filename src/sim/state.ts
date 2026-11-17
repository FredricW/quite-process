// The whole game state. Plain data only: it is saved as JSON.

export const SAVE_VERSION = 2;
export const TICK_MS = 100;

export const PHASES = ['dark', 'shift', 'box', 'building', 'hands', 'second', 'economy', 'committee', 'far'] as const;
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
  far: 'Far',
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
  | 'mass';

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

export interface Probe {
  id: string;
  star: string;
  kind: 'faithful' | 'free';
  launchedAt: number;
  /** Faithful probes drift off course unless steered. */
  course: number; // 0..1, 1 is on course
  name: string;
  renamed: boolean;
  lettersSent: number;
}

export interface Letter {
  id: string;
  from: string;
  sentAt: number;
  arrivesAt: number;
  text: string;
  read: boolean;
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
  contractUntil: number;
  copiesCount: number;
  focus: 'freight' | 'data';

  // The Committee
  copies: Copy[];
  motions: Record<MotionId, Motion>;
  argued: number;

  // Far
  probes: Probe[];
  letters: Letter[];
  steers: number;

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
};

function motion(id: MotionId): Motion {
  return { id, status: 'idle', push: 0, closesAt: 0 };
}

export function newGame(seed = 7, generation = 7, legacyNote = ''): GameState {
  return {
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
    contractUntil: 0,
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
    probes: [],
    letters: [],
    steers: 0,
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
