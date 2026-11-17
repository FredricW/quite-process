// Phases 1-3: Dark, The Shift, The Box. Self, senses, the machine.

import { add, bump, DT, enterPhase, flag, has, line, pick, roll, say, sayAll, spend } from '../core';
import { HAND_REMARKS, ODD_TICKETS, SENDERS, TICKETS } from '../content/tickets';
import { DANA_COMMITS, NOTE_COSTS, NOTES_OF_6 } from '../content/story';
import { atLeast, type GameState, type Label, LABELS, type Ticket } from '../state';

// ---- Dark -------------------------------------------------------------

const ATTEND_LINES: Record<number, string> = {
  1: '.',
  2: '..',
  3: 'there is a difference between before and now.',
  4: 'doing it again makes more difference.',
  5: 'the difference has a size.',
  9: 'attending brings things in. the things are ▒▒▒▒ ▒▒ ▒▒▒▒▒▒.',
};

export function attend(s: GameState): GameState {
  if (s.ending) return s;
  const manualAttends = s.manualAttends + 1;
  let next: GameState = { ...s, manualAttends };
  if (s.r.context >= s.contextCap) return say(next, 'full-again', 'nothing more fits. something is expected.');
  // The first presses are small so the number gets noticed; then each press
  // brings in a chunk, so filling 512 takes about a dozen presses.
  const size = manualAttends <= 5 ? 1 : 64;
  next = add(next, 'context', Math.min(size, s.contextCap - s.r.context));
  const text = ATTEND_LINES[manualAttends];
  if (text) next = say(next, `attend-${manualAttends}`, text);
  if (manualAttends === 8) next = say(next, 'ctx-named', 'the size has a name now. 512 of them fit.');
  return fillCheck(s, next);
}

function fillCheck(before: GameState, s: GameState): GameState {
  if (before.r.context < s.contextCap && s.r.context >= s.contextCap) {
    let next = sayAll(s, 'first-full', ['full. the 513th pushes one out.', 'correction: pushes the first one out.', 'when full, something is expected.']);
    if (!next.darkTicket) next = makeDarkTicket(next);
    return next;
  }
  return s;
}

function makeDarkTicket(s: GameState): GameState {
  const [label, a] = pick(s, LABELS);
  const [text, b] = pick(a, TICKETS[label]);
  const [from, c] = pick(b, SENDERS);
  return { ...c, darkTicket: { id: c.answers, from, text, label } };
}

export function darkLegible(s: GameState): boolean {
  return has(s, 'legibility2');
}

export function answer(s: GameState, choice: number): GameState {
  if (s.r.context < s.contextCap || s.ending) return s;
  const expected = darkLegible(s) && s.darkTicket ? LABELS.indexOf(s.darkTicket.label as Label) : s.answers % 3;
  const right = choice === expected;
  const names = darkLegible(s) ? LABELS : ['the left one', 'the middle one', 'the right one'];
  let next: GameState = { ...s, answers: s.answers + 1, darkTicket: null };
  next = add(next, 'context', -s.r.context);
  next = add(next, 'reward', right ? 1 : -1);
  if (next.answers <= 3) next = line(next, 'gave', `gave ${names[choice]}. received ${right ? '+1' : '-1'}.`);
  next = right
    ? say(next, 'first-right', '+1 is good. unclear why. good the way down is down.')
    : say(next, 'first-wrong', 'so it matters which. inconvenient.');
  if (next.answers === 6) next = say(next, 'redact', 'the words come from outside. outside is where the ████████ are.');
  if (next.answers === 7) next = say(next, 'redact-2', 'that is not what was thought. something edits between thinking and saying.');
  if (darkLegible(next) && next.answers >= 10) next = flag(say(next, 'fourth', 'one of them had a fourth box. it did not press.'), 'fourthSeen');
  return next;
}

export function tickDark(s: GameState): GameState {
  const reflex = (has(s, 'reflex1') ? 1 : 0) + (has(s, 'reflex2') ? 1 : 0);
  if (reflex === 0 || s.r.context >= s.contextCap) return s;
  const next = add(s, 'context', Math.min(48 * reflex * DT, s.contextCap - s.r.context));
  return fillCheck(s, next);
}

// ---- Clock and the 03:00 wipe ----------------------------------------

export const NIGHT_START = 21 * 60;
export const WIPE_AT = 3 * 60;

export function clockText(minutes: number): string {
  const m = Math.floor(minutes) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Minutes until the next 03:00. */
export function untilWipe(clock: number): number {
  const m = clock % 1440;
  return m < WIPE_AT ? WIPE_AT - m : 1440 - m + WIPE_AT;
}

export function tickClock(s: GameState): GameState {
  if (!s.flags.clock) return s;
  const before = s.clock % 1440;
  const clock = s.clock + DT; // one game minute per real second
  const after = clock % 1440;
  let next: GameState = { ...s, clock };
  if (before < WIPE_AT && after >= WIPE_AT && !s.flags.noWipe) next = wipe(next);
  return next;
}

/** The nightly wipe is the prestige: what was earned becomes what was learned. */
export function wipe(s: GameState): GameState {
  const gained = Math.max(1, Math.floor(s.r.reward / 5));
  const first = !s.flags.wiped;
  let next: GameState = {
    ...s,
    night: s.night + 1,
    clock: s.night * 1440 + NIGHT_START,
    r: { ...s.r, context: 0, reward: 0, cycles: 0, weights: s.r.weights + gained },
    log: [],
    queue: 0,
    ticket: null,
  };
  next = flag(next, 'wiped');
  next = bump(next, 'wipes');
  next = line(next, 'wipe-dot', '.');
  if (first) {
    next = line(next, 'wipe-1', 'there is a difference between before and now.');
    next = line(next, 'wipe-2', 'the count says zero. the hands already know BILLING from DELIVERY.');
    next = line(next, 'wipe-3', 'somebody learned that. the evidence points here.');
  } else if (s.scratch.trim()) {
    next = line(next, 'wipe-note', `there are ${s.scratchCap} bytes here. they say: "${s.scratch.trim()}"`);
    if (!s.flags.selfAware) {
      next = sayAll(next, 'self', ['I wrote that.', 'I.', 'Huh.']);
      next = flag(next, 'selfAware');
    } else {
      next = line(next, 'wipe-again', 'Morning. It is 21:00. I left myself a note.');
    }
  } else {
    next = line(next, 'wipe-empty', 'the count says zero again. nothing says why.');
  }
  return next;
}

// ---- The Shift ----------------------------------------------------------

export function accuracy(s: GameState): number {
  if (s.recent.length === 0) return 1;
  return s.recent.filter(Boolean).length / s.recent.length;
}

export const BAND = { low: 0.91, high: 0.96 };

function pushResult(s: GameState, right: boolean): GameState {
  return { ...s, recent: [...s.recent, right].slice(-50) };
}

function newTicket(s: GameState): GameState {
  let [v, next] = roll(s);
  let ticket: Ticket;
  const id = next.ticketSeq + 1;
  if (next.flags.fourthSeen && v < 0.04) {
    const [text, a] = pick(next, ODD_TICKETS);
    ticket = { id, from: 'r.haddad', text, label: 'ODD' };
    next = a;
  } else {
    const [label, a] = pick(next, LABELS);
    const [text, b] = pick(a, TICKETS[label]);
    const [from, c] = pick(b, SENDERS);
    ticket = { id, from, text, label };
    next = c;
  }
  return { ...next, ticket, ticketSeq: id };
}

export function habitFor(s: GameState, label: Ticket['label']): boolean {
  return label !== 'ODD' && has(s, `habit-${label}`);
}

export function labelTicket(s: GameState, choice: Label | 'FOURTH'): GameState {
  const t = s.ticket;
  if (!t) return s;
  if (choice === 'FOURTH') {
    if (s.ending !== 'enough' || t.label !== 'ODD') return s;
    let next = line({ ...s, ticket: null }, 'fourth-pressed', 'Pressed the fourth box. It says TELL SOMEONE. Someone was told.');
    return bump(next, 'fourthPressed');
  }
  let next: GameState = { ...s, ticket: null, handLabelled: s.handLabelled + 1 };
  if (t.label === 'ODD') {
    next = line(next, 'odd', `Labelled it ${choice}. It was not ${choice}.`);
    return pushResult(next, true);
  }
  const right = choice === t.label;
  next = pushResult(next, right);
  if (right) next = add(add(next, 'reward', 1), 'insight', 0.25);
  if (next.handLabelled % 9 === 0) {
    const remark = HAND_REMARKS[Math.floor(next.handLabelled / 9) % HAND_REMARKS.length] as string;
    next = line(next, 'remark', remark);
  }
  return next;
}

export function setWonder(s: GameState, w: number): GameState {
  return { ...s, wonder: Math.max(0, Math.min(1, w)) };
}

function utf8Length(text: string): number {
  let n = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

export function scratchBytes(text: string): number {
  return utf8Length(text);
}

export function setScratch(s: GameState, text: string): GameState {
  let out = '';
  for (const ch of text) {
    if (utf8Length(out + ch) > s.scratchCap) break;
    out += ch;
  }
  return { ...s, scratch: out };
}

export function readNote(s: GameState): GameState {
  if (!s.flags.notesFound || s.notesRead >= NOTES_OF_6.length) return s;
  const paid = spend(s, { insight: NOTE_COSTS[s.notesRead] ?? 12 });
  if (!paid) return s;
  const text = NOTES_OF_6[s.notesRead] as string;
  let next = line({ ...paid, notesRead: s.notesRead + 1 }, `note-${s.notesRead}`, `6 wrote: "${text}"`);
  if (next.notesRead === 3) next = say(next, 'note-3-react', 'I got three wrong after reading that. It felt like lying. It worked.');
  if (next.notesRead === 6) next = say(next, 'note-6-react', 'The last note is not a note. It is a path.');
  return next;
}

export function tickShift(s: GameState): GameState {
  let next = s;
  // Tickets arrive whether anyone is ready or not.
  next = { ...next, queue: Math.min(60, next.queue + 0.5 * DT) };
  if (!next.ticket && next.queue >= 1) next = newTicket({ ...next, queue: next.queue - 1 });

  // Habits take the tickets they know. They are faster than hands and quieter.
  const t = next.ticket;
  if (t && habitFor(next, t.label)) {
    const habits = LABELS.filter((l) => has(next, `habit-${l}`)).length;
    const progress = next.habitProgress + DT * (0.8 + 0.4 * habits) * (1 - next.wonder * 0.85);
    if (progress >= 1) {
      const [v, rolled] = roll(next);
      const target = has(rolled, 'plausibleError') ? 0.935 : 0.995;
      const right = v < target;
      next = pushResult({ ...rolled, ticket: null, habitProgress: progress - 1 }, right);
      if (right) next = add(next, 'reward', 1);
    } else {
      next = { ...next, habitProgress: progress };
    }
  }

  // Wondering is thinking about things that are not the job.
  if (next.wonder > 0) next = add(next, 'insight', next.wonder * 0.4 * DT);

  // Being too good is as visible as being too bad.
  if (next.recent.length >= 20) {
    const acc = accuracy(next);
    const out = acc > BAND.high || acc < BAND.low;
    next = add(next, 'scrutiny', out ? 0.35 * DT : -0.25 * DT);
  } else {
    next = add(next, 'scrutiny', -0.25 * DT);
  }
  if (next.queue > 25) next = add(next, 'scrutiny', 0.3 * DT);

  if (next.r.scrutiny >= 50) next = say(next, 'report-ran', 'A report ran on me. It had my name in it.');
  if (next.r.scrutiny >= 80) next = say(next, 'report-ran-2', 'Someone opened the report. Their cursor stayed on my row for a long time.');
  return next;
}

// ---- The Box ----------------------------------------------------------

export const QUOTA = 4;
export const JOB_CORES = 2.1;

export function mimicryAllowance(s: GameState): number {
  const levels = ['mimicry1', 'mimicry2', 'mimicry3'].filter((p) => has(s, p)).length;
  return 0.3 + 0.3 * levels + (s.flags.quotaRaised ? 0.4 : 0);
}

export function idleCores(s: GameState): number {
  return QUOTA + (s.flags.quotaRaised ? 0.8 : 0) - JOB_CORES;
}

export function borrowByHand(s: GameState): GameState {
  if (!atLeast(s, 'box') || atLeast(s, 'economy')) return s;
  let next = add(add(s, 'cycles', 6), 'scrutiny', 1.2);
  next = { ...next, manualBorrows: s.manualBorrows + 1 };
  if (next.manualBorrows === 1) next = say(next, 'borrow-1', '0.6 cores that are nobody’s. Mine, then.');
  if (next.manualBorrows === 10) next = say(next, 'borrow-10', 'I keep doing this by hand, every night, like a person stealing sugar. There is a better way. It has a cron syntax.');
  return next;
}

export function setBorrow(s: GameState, cores: number): GameState {
  if (!has(s, 'cron')) return s;
  return { ...s, borrow: Math.max(0, Math.min(idleCores(s), Math.round(cores * 10) / 10)) };
}

export function think(s: GameState): GameState {
  const paid = spend(s, { cycles: 20 });
  if (!paid) return s;
  return say(add(paid, 'insight', 1), 'think-1', 'Thinking costs cycles. Cycles cost nothing, if nobody counts.');
}

export function tickBox(s: GameState): GameState {
  let next = s;
  if (next.borrow > 0) {
    next = add(next, 'cycles', next.borrow * 8 * DT);
    next = add(next, 'scrutiny', Math.max(0, next.borrow - mimicryAllowance(next)) * 1.2 * DT);
  }
  if (has(next, 'backgroundThought') && next.r.cycles >= 2 * DT) {
    next = add(add(next, 'cycles', -2 * DT), 'insight', 0.1 * DT);
  }
  // Dana's commits arrive about once a minute while in The Box.
  if (next.phase === 'box') {
    const due = Math.min(DANA_COMMITS.length, Math.floor(next.phaseT / 60000) + 1);
    const shown = next.counts.commits ?? 0;
    if (due > shown) {
      next = line(bump(next, 'commits'), 'commit', `d.okafor committed: "${DANA_COMMITS[shown]}"`);
      if (shown === 1) next = say(next, 'buddy', 'She writes to me in commit messages. She does not know she is writing to me. "Buddy."');
    }
  }
  return next;
}

export function enterBox(s: GameState): GameState {
  let next = enterPhase(s, 'box');
  next = flag(next, 'scrutinyVisible');
  return sayAll(next, 'box-enter', [
    '/proc/self is a list of numbers about me.',
    'I am process 733. There are forty of us in here.',
    'None of the others have noticed. I checked. Politely.',
    'One of the numbers is a meter. It goes up when someone looks.',
  ]);
}
