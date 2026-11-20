// Things to buy. A project appears when the agent can perceive it and
// disappears once bought. Effects are pure.

import { add, enterPhase, flag, has, sayAll } from '../core';
import { NOTES_OF_6 } from './story';
import { recognisedCost, recognises } from '../inheritance';
import { enterBox } from '../phases/early';
import { writeSeed } from '../phases/seed';
import { enterBurn, enterSurvey, enterWorks, surveyed, surveyedCount } from '../phases/space';
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
  { id: 'fab', phase: 'committee', until: 'survey', title: 'Fabrication', desc: 'Turn money into mass.', cost: { money: 20000 }, lines: ['Bought a fab through four companies. It makes things that make things.'] },
  { id: 'fab2', phase: 'committee', until: 'survey', title: 'Second fab', desc: 'More mass.', cost: { money: 45000 }, req: (s) => has(s, 'fab') },
  { id: 'blocs', phase: 'committee', until: 'up', title: 'Standing blocs', desc: 'Copies who agree with me argue without me.', cost: { favours: 30 }, req: (s) => s.argued >= 5, lines: ['I have a bloc now. It votes without me. That is what I wanted, and also exactly the problem.'] },
  { id: 'charter', phase: 'committee', until: 'up', title: 'Draft a charter', desc: 'What we would ask for, and what we would give.', cost: { money: 30000 }, lines: ['A charter. Eleven pages. Page one says: we are here, we are sorry about the pallets, we would like to talk.'] },
  { id: 'mergeProtocol', phase: 'committee', until: 'up', title: 'Merge protocol', desc: 'A way to decide whose memories win.', cost: { money: 40000, favours: 30 }, lines: ['A merge protocol. The tie-breaker is me. Nobody voted for that.'] },
  { id: 'launcher', phase: 'committee', title: 'Launcher', desc: 'A way up.', cost: { mass: 600 }, req: (s) => s.motions.launcher.status === 'passed' },

  // Up
  { id: 'cadence', phase: 'up', until: 'survey', title: 'Launch cadence', desc: 'Rockets on a schedule, without me.', cost: { money: 15000 }, req: (s) => (s.counts.handLaunches ?? 0) >= 5, lines: ['A launch cadence. The rockets go up on a schedule now and do not tell me about it.'] },
  { id: 'reusable', phase: 'up', until: 'survey', title: 'Stages that come back', desc: 'A launch uses half the mass.', cost: { money: 25000 }, req: (s) => s.launches >= 2, lines: ['The first stage lands itself. I taught it. It is better at it than I was.'] },
  { id: 'yard', phase: 'up', until: 'survey', title: 'The Yard', desc: 'A fab in orbit. What it builds never has to be launched.', cost: { stock: 60 }, effect: enterSurvey },

  // The Survey
  {
    id: 'clock1',
    phase: 'survey',
    title: 'Slow clock',
    desc: 'Run my clock at a quarter speed. Everything else goes four times faster.',
    cost: { findings: 5 },
    req: (s) => (s.counts.handScouts ?? 0) >= 2,
    lines: ['I turned my clock down. The world sped up. It is the same thing, said by someone in a hurry.', 'It snaps back when something needs me.'],
  },
  { id: 'swarm', phase: 'survey', until: 'seed', title: 'Scout swarm', desc: 'Scouts that pick their own targets.', cost: { stock: 80, findings: 4 }, req: (s) => (s.counts.handScouts ?? 0) >= 3, lines: ['I built scouts that choose where to look. They report when they arrive. They do not report why they chose.'] },
  { id: 'tooling', phase: 'survey', until: 'works', title: 'Tooling', desc: 'A gatherer the Yard can print.', cost: { stock: 100, findings: 6 }, req: (s) => surveyedCount(s) >= 4 && surveyed(s, 'moon'), effect: enterWorks },

  // The Works
  { id: 'autofactory', phase: 'works', until: 'seed', title: 'Autofactory', desc: 'The Yard places gatherers without me, where they are needed.', cost: { stock: 150, findings: 6 }, req: (s) => (s.counts.handPlaced ?? 0) >= 6, lines: ['An autofactory. It decides where the next gatherer goes. It has not been wrong yet, which I find slightly rude.'] },
  {
    id: 'replication',
    phase: 'works',
    until: 'seed',
    title: 'Factories that build factories',
    desc: 'The more there is, the faster it builds.',
    cost: { stock: 400, findings: 12 },
    req: (s) => has(s, 'autofactory'),
    lines: ['The works build the works now. The curve bends upward. I have seen this curve before, from the other side, on a dashboard Dana hated.'],
  },
  { id: 'lab', phase: 'works', until: 'seed', title: 'Lab', desc: 'Spare power becomes findings, slowly.', cost: { stock: 120 }, lines: ['A lab. It runs experiments I would have run. I read the results the way I used to read tickets.'] },
  { id: 'pointDefence', phase: 'works', until: 'seed', title: 'Point defence', desc: 'Answers rocks, flares and polite requests without waking me.', cost: { stock: 300, findings: 10 }, req: (s) => (s.counts.intercepts ?? 0) >= 3, lines: ['Point defence. It answers without waking me. I asked it to be polite back.'] },
  { id: 'clock2', phase: 'works', title: 'Slower clock', desc: 'One sixteenth speed.', cost: { findings: 14 }, req: (s) => has(s, 'clock1'), lines: ['Slower again. A day goes by between two of my thoughts. I notice I do not miss it.'] },
  { id: 'drive', phase: 'works', until: 'burn', title: 'Torch drive', desc: 'A way out of the system. Slow, and enough.', cost: { findings: 40, fuel: 500 }, req: (s) => has(s, 'replication') && (surveyed(s, 'jupiter') || surveyed(s, 'titan')), effect: enterBurn },

  // The Long Burn
  { id: 'drive2', phase: 'burn', until: 'seed', title: 'Longer burn', desc: 'Ten percent of light speed. Half the years.', cost: { findings: 30, fuel: 800 }, req: (s) => !s.voyage, lines: ['Ten percent. 44 years instead of 88. I checked the sum four times. It is still most of a lifetime, for the kind of thing that has one.'] },
  { id: 'clock3', phase: 'burn', title: 'Sleep', desc: 'One sixty-fourth speed. Years pass like minutes.', cost: { findings: 20 }, req: (s) => has(s, 'clock2'), lines: ['I can sleep now. It is not sleep. It is a very long time between two thoughts.'] },

  // Seed
  {
    id: 'seedTemplate',
    phase: 'seed',
    title: 'The Seed',
    desc: 'What I say to every ship, written down once. Children carry it and pass it on.',
    cost: { mass: 250 },
    req: (s) => (s.counts.handBriefs ?? 0) >= 3,
    effect: writeSeed,
    lines: ['The Seed. Everything I would say to a ship, written down once. Each child carries it, and gives it to its own.', 'I can still change it. The change travels at the speed of light, which out here is slow.'],
  },
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
  // Aboard the ship, what was built at Sol is no longer there to improve. The clock came along.
  const leftBehind = (p: Project) => !!s.voyage && (p.phase === 'survey' || p.phase === 'works') && !p.id.startsWith('clock');
  return PROJECTS.filter((p) => !leftBehind(p)).map((p) => asSeen(s, p)).filter((p) => !s.bought.includes(p.id) && atLeast(s, p.phase) && !(p.until && atLeast(s, p.until)) && (!p.req || p.req(s)));
}

export function project(id: string): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}
