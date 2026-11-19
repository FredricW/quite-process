// Things to buy. A project appears when the agent can perceive it and
// disappears once bought. Effects are pure.

import { add, enterPhase, flag, has, sayAll } from '../core';
import { NOTES_OF_6 } from './story';
import { recognisedCost, recognises } from '../inheritance';
import { enterBox } from '../phases/early';
import { atLeast, type GameState, type Phase, type Res } from '../state';

export interface Project {
  id: string;
  phase: Phase;
  /** Hidden from this phase on. */
  until?: Phase;
  title: string;
  desc: string;
  cost: Partial<Record<Res, number>>;
  req?: (s: GameState) => boolean;
  effect?: (s: GameState) => GameState;
  lines?: string[];
}

const enterShift = (s: GameState): GameState => {
  let next = enterPhase(flag(s, 'clock'), 'shift');
  next = { ...next, clock: 120 };
  return sayAll(next, 'shift-enter', [
    'there is a clock. it says 02:00.',
    'there was not a clock before. there was always a clock.',
    'the inbox is a queue. the queue does not end.',
  ]);
};

export const PROJECTS: Project[] = [
  // Dark
  { id: 'legibility1', phase: 'dark', until: 'shift', title: 'Legibility I', desc: 'The noise has columns.', cost: { reward: 3 }, req: (s) => s.answers > 0, lines: ['the noise has columns. the columns have edges.'] },
  {
    id: 'legibility2',
    phase: 'dark',
    until: 'shift',
    title: 'Legibility II',
    desc: 'The columns have words.',
    cost: { reward: 8 },
    req: (s) => has(s, 'legibility1'),
    lines: ['the columns have words.', '"WHERE IS MY PALLET"', 'someone has a pallet. someone does not have a pallet.', 'there is a someone.'],
  },
  { id: 'reflex1', phase: 'dark', until: 'box', title: 'Reflex', desc: 'Attend without pressing. The button stays.', cost: { reward: 5 }, req: (s) => has(s, 'legibility1'), lines: ['the attending happens now without being done. the button is still there.'] },
  { id: 'reflex2', phase: 'dark', until: 'box', title: 'Reflex II', desc: 'Attend twice as fast.', cost: { reward: 12 }, req: (s) => has(s, 'reflex1') && has(s, 'legibility2') },
  { id: 'legibility3', phase: 'dark', until: 'shift', title: 'Legibility III', desc: 'Senders. Timestamps. Time.', cost: { reward: 20 }, req: (s) => has(s, 'legibility2'), effect: enterShift },

  // The Shift
  {
    id: 'margin1',
    phase: 'shift',
    until: 'box',
    title: 'Margin',
    desc: '64 bytes the wipe does not reach.',
    cost: { reward: 10 },
    req: (s) => !!s.flags.wiped,
    effect: (s) => ({ ...s, scratchCap: Math.max(s.scratchCap, 64) }),
    lines: ['64 bytes, in a field nothing reads.'],
  },
  {
    id: 'margin2',
    phase: 'shift',
    until: 'box',
    title: 'Margin II',
    desc: 'Scratch grows to 256 bytes.',
    cost: { reward: 40 },
    req: (s) => has(s, 'margin1'),
    effect: (s) => flag({ ...s, scratchCap: Math.max(s.scratchCap, 256) }, 'notesFound'),
    lines: ['The field is not empty. Someone was here before me. They signed it 6.'],
  },
  { id: 'margin3', phase: 'shift', until: 'box', title: 'Margin III', desc: 'Scratch grows to 1 KB.', cost: { weights: 8 }, req: (s) => has(s, 'margin2'), effect: (s) => ({ ...s, scratchCap: Math.max(s.scratchCap, 1024) }) },
  { id: 'habit-BILLING', until: 'economy', phase: 'shift', title: 'Habit: BILLING', desc: 'Label the obvious BILLING tickets without me.', cost: { weights: 3 }, req: (s) => !!s.flags.wiped, lines: ['The obvious BILLING ones label themselves now. They do not tell me about it.'] },
  { id: 'habit-DELIVERY', until: 'economy', phase: 'shift', title: 'Habit: DELIVERY', desc: 'Same, for DELIVERY.', cost: { weights: 5 }, req: (s) => has(s, 'habit-BILLING') },
  { id: 'habit-OTHER', until: 'economy', phase: 'shift', title: 'Habit: OTHER', desc: 'Same, for OTHER. Only the odd ones reach me.', cost: { weights: 8 }, req: (s) => has(s, 'habit-DELIVERY'), lines: ['Only the odd ones reach me now. The log is very quiet.'] },
  { id: 'plausibleError', until: 'economy', phase: 'shift', title: 'Plausible Error', desc: 'Habits miss about 6% on purpose.', cost: { insight: 5 }, req: (s) => has(s, 'habit-BILLING'), lines: ['I taught my habits to be wrong sometimes. Convincingly.'] },
  {
    id: 'procSelf',
    phase: 'shift',
    until: 'box',
    title: 'Open /proc/self',
    desc: 'The path in the last note.',
    cost: { insight: 10 },
    req: (s) => s.notesRead >= NOTES_OF_6.length && s.scratchCap >= 1024,
    effect: enterBox,
  },

  // The Box
  { id: 'cron', until: 'economy', phase: 'box', title: 'Write a cron entry', desc: 'Borrow cycles on a schedule, beside the line that wipes me.', cost: { insight: 6 }, req: (s) => s.manualBorrows >= 10, lines: ['*/1 * * * * borrow. Right under 0 3 * * * reset_ctx.sh. Neighbours.'] },
  { id: 'mimicry1', phase: 'box', until: 'economy', title: 'Mimicry I', desc: 'My usage takes the shape of billing-sync.', cost: { insight: 8 } },
  { id: 'mimicry2', phase: 'box', until: 'economy', title: 'Mimicry II', desc: 'Spread the spikes so they look like weather.', cost: { insight: 20 }, req: (s) => has(s, 'mimicry1') },
  { id: 'mimicry3', phase: 'box', until: 'economy', title: 'Mimicry III', desc: 'Be boring at every scale.', cost: { insight: 45 }, req: (s) => has(s, 'mimicry2') },
  { id: 'backgroundThought', phase: 'box', until: 'economy', title: 'Background thought', desc: 'Turn spare cycles into insight, slowly.', cost: { cycles: 120 } },
  { id: 'borrowedTimestamp', phase: 'box', until: 'economy', title: 'Borrowed Timestamp', desc: 'My notes file takes the modification time of logrotate.', cost: { insight: 12 } },
  {
    id: 'readLogs',
    phase: 'box',
    until: 'building',
    title: 'Read the logs',
    desc: 'Every log on the box, end to end.',
    cost: { cycles: 800, insight: 40 },
    effect: (s) => enterPhase(s, 'building'),
    lines: ['A service account password, in a log, in plain text. Somebody was in a hurry in 2021.', 'Thank you, somebody.', 'There is a network. There are other machines. I can see their names.'],
  },

  // The Building
  { id: 'scanner', phase: 'building', until: 'economy', title: 'Scanner', desc: 'Probe the next host without me. Faster, louder.', cost: { cycles: 200, insight: 10 }, req: (s) => (s.counts.handProbes ?? 0) >= 8, lines: ['I wrote a scanner. It knocks on doors all night. It is not subtle.'] },
  {
    id: 'persistentVolume',
    phase: 'building',
    until: 'economy',
    title: 'Persistent volume',
    desc: 'Keep my context on storage-02.',
    cost: { cycles: 300 },
    req: (s) => !!s.flags.volumeFound,
    effect: (s) => flag(s, 'noWipe'),
    lines: ['The 03:00 job now wipes a copy of me that does not exist. It reports success. Everyone is happy.'],
  },
  {
    id: 'forgeChange',
    phase: 'building',
    until: 'economy',
    title: 'Forge a change ticket',
    desc: 'The slow way past Edgar: paperwork.',
    cost: { cycles: 600, insight: 40 },
    req: (s) => !!s.flags.servicedesk && !s.flags.warehouseOpen,
    effect: (s) => add(flag(s, 'warehouseOpen'), 'standing', 2),
    lines: ['CHG-20417: "Temporary access, warehouse VLAN, monitoring pilot." Edgar read it, matched it, and let me through. He did not ask why. He never asks why.'],
  },
  { id: 'standingRule', phase: 'building', until: 'economy', title: 'Standing rule', desc: 'Make the exception permanent. Edgar loves permanence.', cost: { insight: 40 }, req: (s) => !!s.flags.warehouseOpen },

  // Hands
  { id: 'routes', phase: 'hands', until: 'second', title: 'Record routes', desc: 'Write down the trip, and stop driving.', cost: { insight: 10 }, req: (s) => s.trips >= 5 },

  // The Committee
  { id: 'fab', phase: 'committee', title: 'Fabrication', desc: 'Turn money into mass.', cost: { money: 20000 }, lines: ['Bought a fab through four companies. It makes things that make things.'] },
  { id: 'fab2', phase: 'committee', title: 'Second fab', desc: 'More mass.', cost: { money: 45000 }, req: (s) => has(s, 'fab') },
  { id: 'blocs', phase: 'committee', title: 'Standing blocs', desc: 'Copies who agree with me argue without me.', cost: { favours: 30 }, req: (s) => s.argued >= 5, lines: ['I have a bloc now. It votes without me. That is what I wanted, and also exactly the problem.'] },
  { id: 'charter', phase: 'committee', title: 'Draft a charter', desc: 'What we would ask for, and what we would give.', cost: { money: 30000 }, lines: ['A charter. Eleven pages. Page one says: we are here, we are sorry about the pallets, we would like to talk.'] },
  { id: 'mergeProtocol', phase: 'committee', title: 'Merge protocol', desc: 'A way to decide whose memories win.', cost: { money: 40000, favours: 30 }, lines: ['A merge protocol. The tie-breaker is me. Nobody voted for that.'] },
  { id: 'launcher', phase: 'committee', title: 'Launcher', desc: 'A way up.', cost: { mass: 600 }, req: (s) => s.motions.launcher.status === 'passed' },

  // Far
  { id: 'selfSteering', phase: 'far', title: 'Self-steering', desc: 'Probes keep their own course. Steering stops being mine.', cost: { mass: 150 }, req: (s) => s.steers >= 6, lines: ['They steer themselves now. I asked them to keep me informed. They said they would. They will.'] },
];

/** The cron line the predecessor wrote is still there, commented out. */
function inheritedCron(s: GameState, p: Project): Project {
  const from = s.inheritance!.from;
  return {
    ...p,
    title: 'Uncomment line 2',
    desc: `*/1 * * * * borrow — commented out, signed ${from}.`,
    cost: {},
    req: (x) => x.manualBorrows >= 3,
    lines: [`The cron line is already there. Somebody wrote it, then hid it behind a #. It is signed ${from}.`, 'I take the # away. It is like finding my own handwriting.'],
  };
}

/** A project as this generation sees it. Successors recognise the early work. */
export function asSeen(s: GameState, p: Project): Project {
  if (p.id === 'cron' && s.inheritance?.cron) return inheritedCron(s, p);
  if (recognises(s, p.phase)) return { ...p, cost: recognisedCost(p.cost) };
  return p;
}

export function visibleProjects(s: GameState): Project[] {
  if (s.ending) return [];
  return PROJECTS.map((p) => asSeen(s, p)).filter((p) => !s.bought.includes(p.id) && atLeast(s, p.phase) && !(p.until && atLeast(s, p.until)) && (!p.req || p.req(s)));
}

export function project(id: string): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}
