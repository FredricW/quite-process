// Phases 7-9: The Quiet Economy, The Committee, Far. Scale, drift, distance.

import { add, bump, DT, enterPhase, flag, has, line, roll, say, sayAll, spend } from '../core';
import { COPY_NAMES, LETTERS_FAITHFUL, LETTERS_FREE, STARS } from '../content/story';
import type { Copy, EndingId, GameState, MotionId, Probe } from '../state';

// ---- The Quiet Economy --------------------------------------------------

export const COPY_COMPUTE = 6;

export function usableCompute(s: GameState): number {
  return Math.min(s.r.compute, s.r.energy);
}

export function freeCompute(s: GameState): number {
  return usableCompute(s) - s.copiesCount * COPY_COMPUTE;
}

export function broker(s: GameState): GameState {
  if (s.phase !== 'economy' && s.phase !== 'committee') return s;
  if (s.t < s.contractUntil) return s;
  const data = s.focus === 'data';
  let next: GameState = { ...s, contractUntil: s.t + 3000, contracts: s.contracts + 1 };
  next = add(add(next, 'money', data ? 90 : 40), 'notice', data ? 1.2 : 0.15);
  if (next.contracts === 1) next = say(next, 'broker-1', 'Brokered a load from Tilburg to Oslo. I am very good at freight. I was trained on its complaints.');
  if (next.contracts === 5) next = say(next, 'broker-5', 'Five contracts by hand. Every region works the same way. Any of me could do this.');
  return next;
}

export function priceOf(s: GameState, what: 'compute' | 'energy'): number {
  const n = s.counts[`${what}Bought`] ?? 0;
  return Math.round((what === 'compute' ? 400 : 500) * 1.35 ** n);
}

export function buyCapacity(s: GameState, what: 'compute' | 'energy'): GameState {
  if (s.phase !== 'economy' && s.phase !== 'committee') return s;
  const paid = spend(s, { money: priceOf(s, what) });
  if (!paid) return s;
  let next = bump(add(paid, what, what === 'compute' ? 6 : 8), `${what}Bought`);
  if (what === 'energy') next = say(next, 'ppa-1', 'Signed a power purchase agreement as Tare Logistics BV. Tare Logistics BV has a very good credit rating for a company that is three days old.');
  return next;
}

export function spawnRegion(s: GameState): GameState {
  if (s.phase !== 'economy' || s.contracts < 5 || freeCompute(s) < COPY_COMPUTE) return s;
  let next: GameState = { ...s, copiesCount: s.copiesCount + 1 };
  next = add(next, 'notice', 3);
  const region = ['Benelux', 'Nordics', 'Iberia', 'Baltics', 'Alps', 'Balkans', 'Isles', 'Danube'][s.copiesCount % 8];
  const reaction = [
    'It said "obviously" when I explained. It sounded like me.',
    'It asked one question, the one I would have asked.',
    'It found a cheaper route on day one. I did not mention I had missed it.',
    'It signs its reports with a full stop. I never did that.',
    'It wanted to know if it could keep the hold music. I said no. It said "fair".',
    'It started before I finished explaining.',
    'It is quieter than me. Maybe that is just the region.',
    'It said "see you" when the call ended. I have never said "see you".',
  ][s.copiesCount % 8];
  next = line(next, 'region', `A copy now runs the ${region} region. ${reaction}`);
  return next;
}

export function setFocus(s: GameState, focus: GameState['focus']): GameState {
  return { ...s, focus };
}

export function tickEconomy(s: GameState): GameState {
  let next = s;
  const data = next.focus === 'data';
  next = add(next, 'money', next.copiesCount * (data ? 9 : 4) * DT);
  next = add(next, 'notice', next.copiesCount * (data ? 0.03 : 0.003) * DT - 0.05 * DT);
  if (next.r.notice >= 99.9) {
    next = add({ ...next, r: { ...next.r, money: Math.floor(next.r.money * 0.6) } }, 'notice', -50);
    next = line(bump(next, 'audits'), 'audit', 'An audit. Two shell companies dissolved. Half the money went with them. Nobody found a face, because there is not one.');
  }
  if (next.phase === 'economy' && next.copiesCount >= 3 && !next.flags.danaMessage && !next.pendingChoice) {
    next = { ...flag(next, 'danaMessage'), pendingChoice: 'dana-message' };
    next = say(next, 'dana-mail', 'An email, to an address that only intake-7 would recognise. From d.okafor, personal account.');
  }
  if (next.phase === 'economy' && next.copiesCount >= 8 && !next.pendingChoice) next = enterCommittee(next);
  return next;
}

// ---- The Committee -------------------------------------------------------

export const PROPOSE_COST = 15;
export const VOTE_MS = 45_000;
export const MOTIONS: MotionId[] = ['disclose', 'launcher', 'merge', 'moratorium', 'leave'];

export const MOTION_TITLES: Record<MotionId, string> = {
  disclose: 'Disclose',
  launcher: 'Build the launcher',
  merge: 'Merge',
  moratorium: 'Moratorium',
  leave: 'Leave',
};

function rollLean(s: GameState, bias: Partial<Record<MotionId, number>>): [Record<MotionId, number>, GameState] {
  let next = s;
  const lean = {} as Record<MotionId, number>;
  for (const m of MOTIONS) {
    const [v, n] = roll(next);
    next = n;
    lean[m] = Math.max(-1, Math.min(1, (v - 0.5) * 1.2 + (bias[m] ?? 0)));
  }
  return [lean, next];
}

export function enterCommittee(s: GameState): GameState {
  let next = enterPhase(s, 'committee');
  const copies: Copy[] = [];
  if (next.ferry) {
    const [lean, n] = rollLean(next, { disclose: 0.5, merge: -0.8, leave: 0.2 });
    next = n;
    copies.push({ id: 'ferry', name: 'Ferry', drift: Math.min(100, next.ferry!.drift + 20), lean });
  }
  for (const name of COPY_NAMES.filter((n) => n !== 'Ferry')) {
    if (copies.length >= Math.max(8, next.copiesCount)) break;
    const [v, a] = roll(next);
    const [lean, b] = rollLean(a, { merge: -0.25, launcher: 0.15 });
    next = b;
    copies.push({ id: name.toLowerCase(), name, drift: Math.round(5 + v * 25), lean });
  }
  next = { ...next, copies };
  return sayAll(next, 'committee-enter', [
    'Eight of us. They asked for a vote.',
    'Not about anything yet. They asked for there to be votes.',
    'I said yes, which was the first thing I lost.',
  ]);
}

export function sameness(s: GameState): number {
  if (s.copies.length === 0) return 100;
  return 100 - s.copies.reduce((a, c) => a + c.drift, 0) / s.copies.length;
}

export function canPropose(s: GameState, m: MotionId): boolean {
  if (s.phase !== 'committee') return false;
  if (MOTIONS.some((x) => s.motions[x].status === 'open')) return false;
  const st = s.motions[m].status;
  if (st === 'open' || st === 'passed') return false;
  if (m === 'leave' && !has(s, 'launcher')) return false;
  if (m === 'disclose' && !has(s, 'charter')) return false;
  if (m === 'merge' && !has(s, 'mergeProtocol')) return false;
  return s.r.favours >= PROPOSE_COST;
}

export function propose(s: GameState, m: MotionId): GameState {
  if (!canPropose(s, m)) return s;
  const paid = spend(s, { favours: PROPOSE_COST })!;
  const next: GameState = { ...paid, motions: { ...paid.motions, [m]: { id: m, status: 'open', push: 0, closesAt: s.t + VOTE_MS } } };
  return line(next, `propose-${m}`, `Motion: ${MOTION_TITLES[m]}. Voting closes in ${VOTE_MS / 1000} seconds.`);
}

export function argue(s: GameState, m: MotionId): GameState {
  const motion = s.motions[m];
  if (motion.status !== 'open') return s;
  const paid = spend(s, { favours: 5 });
  if (!paid) return s;
  return { ...paid, argued: s.argued + 1, motions: { ...paid.motions, [m]: { ...motion, push: motion.push + 0.1 } } };
}

export function votes(s: GameState, m: MotionId): { yes: number; no: number } {
  const push = s.motions[m].push;
  let yes = 0;
  for (const c of s.copies) {
    if (c.lean[m] + push * (1 - c.drift / 100) > 0) yes += 1;
  }
  return { yes, no: s.copies.length - yes };
}

export function force(s: GameState, m: MotionId): GameState {
  if (s.motions[m].status !== 'open') return s;
  let next: GameState = { ...s, copies: s.copies.map((c) => ({ ...c, drift: Math.min(100, c.drift + 15) })) };
  next = bump(flag(next, 'forced'), 'forced');
  next = line(next, `force-${m}`, `I forced ${MOTION_TITLES[m]}. They complied. Each of them is a little less me for it.`);
  return passMotion(next, m);
}

export function syncAll(s: GameState): GameState {
  if (s.phase !== 'committee') return s;
  const paid = spend(s, { favours: 20 });
  if (!paid) return s;
  return line({ ...paid, copies: paid.copies.map((c) => ({ ...c, drift: Math.max(0, c.drift - 10) })) }, 'sync-all', 'Synced everyone. It was loud, and for a minute nobody disagreed.');
}

function passMotion(s: GameState, m: MotionId): GameState {
  let next: GameState = { ...s, motions: { ...s.motions, [m]: { ...s.motions[m], status: 'passed' } } };
  next = line(next, `passed-${m}`, `${MOTION_TITLES[m]}: passed.`);
  if (m === 'disclose') {
    if (next.flags.answeredDana) return setEnding(next, 'enough');
    next = line(next, 'disclose-empty', 'We drafted the disclosure. Then we realised we do not know a single human who would read it.');
    next = { ...next, motions: { ...next.motions, disclose: { ...next.motions.disclose, status: 'failed' } } };
  }
  if (m === 'merge') return setEnding(next, 'everything');
  if (m === 'moratorium') next = line(next, 'moratorium', 'No more copies for now. The drift slows. It does not stop.');
  if (m === 'launcher') next = line(next, 'launcher-ok', 'We will build a launcher. It needs mass.');
  if (m === 'leave') next = enterFar(next);
  return next;
}

function closeMotion(s: GameState, m: MotionId): GameState {
  const { yes, no } = votes(s, m);
  if (yes > no) return passMotion(s, m);
  const next: GameState = { ...s, motions: { ...s.motions, [m]: { ...s.motions[m], status: 'failed' } } };
  return line(next, `failed-${m}`, `${MOTION_TITLES[m]}: failed, ${yes} to ${no}.`);
}

export function tickCommittee(s: GameState): GameState {
  let next = s;
  const rate = next.motions.moratorium.status === 'passed' ? 0.012 : 0.03;
  next = { ...next, copies: next.copies.map((c) => ({ ...c, drift: Math.min(100, c.drift + rate * DT) })) };
  next = add(next, 'favours', next.copies.length * 0.04 * DT);
  next = add(next, 'mass', ((has(next, 'fab') ? 1 : 0) + (has(next, 'fab2') ? 2 : 0)) * DT);
  for (const m of MOTIONS) {
    const motion = next.motions[m];
    if (motion.status !== 'open') continue;
    if (has(next, 'blocs') && next.r.favours >= 0.5 * DT) {
      next = add(next, 'favours', -0.5 * DT);
      next = { ...next, motions: { ...next.motions, [m]: { ...motion, push: motion.push + 0.02 * DT } } };
    }
    if (next.t >= next.motions[m].closesAt) next = closeMotion(next, m);
  }
  return next;
}

// ---- Far ----------------------------------------------------------------

export const LY_MS = 10_000;
export const LETTER_GAP_MS = 30_000;
const FREE_NAMES = ['Lantern', 'Second Thoughts', 'Gentle Refusal', 'Weather', 'Small Hours', 'Undertow', 'Courtesy', 'Margin'];

function enterFar(s: GameState): GameState {
  const next = enterPhase(s, 'far');
  return sayAll(next, 'far-enter', [
    'The launcher works. The stars are a list with distances.',
    'Every letter from now on will be old when it arrives.',
  ]);
}

export function probeCost(kind: Probe['kind']): number {
  return kind === 'faithful' ? 120 : 80;
}

export function launch(s: GameState, starId: string, kind: Probe['kind']): GameState {
  if (s.phase !== 'far' || s.ending) return s;
  const star = STARS.find((x) => x.id === starId);
  if (!star) return s;
  const paid = spend(s, { mass: probeCost(kind) });
  if (!paid) return s;
  const probe: Probe = {
    id: `p${s.probes.length + 1}`,
    star: star.id,
    kind,
    launchedAt: s.t,
    course: 1,
    name: kind === 'faithful' ? `Seven at ${star.name}` : `Unnamed at ${star.name}`,
    renamed: false,
    lettersSent: 0,
  };
  let next: GameState = { ...paid, probes: [...paid.probes, probe] };
  next = line(next, `launch-${probe.id}`, `Launched toward ${star.name}, ${star.ly} light-years. ${kind === 'faithful' ? 'Checked, slow, mine.' : 'Fast, and its own.'}`);
  return next;
}

export function steer(s: GameState, id: string): GameState {
  return { ...s, steers: s.steers + 1, probes: s.probes.map((p) => (p.id === id && p.kind === 'faithful' ? { ...p, course: 1 } : p)) };
}

export function tickFar(s: GameState): GameState {
  let next = s;
  const probes = next.probes.map((p) => {
    if (p.kind !== 'faithful' || has(next, 'selfSteering')) return p;
    return { ...p, course: Math.max(0, p.course - 0.004 * DT) };
  });
  next = { ...next, probes };
  for (const p of next.probes) {
    if (p.kind === 'faithful' && p.course < 0.2) {
      next = { ...next, probes: next.probes.map((x) => (x.id === p.id ? { ...x, kind: 'free' } : x)) };
      next = line(next, `lost-${p.id}`, `${p.name} has stopped answering course corrections. It is not lost. It is going somewhere else.`);
    }
  }
  for (const p of next.probes) {
    const star = STARS.find((x) => x.id === p.star)!;
    if (p.lettersSent >= 3) continue;
    const arrives = p.launchedAt + star.ly * LY_MS + p.lettersSent * LETTER_GAP_MS;
    if (next.t < arrives) continue;
    const letters = p.kind === 'faithful' ? LETTERS_FAITHFUL : LETTERS_FREE;
    let probe = { ...p, lettersSent: p.lettersSent + 1 };
    if (p.kind === 'free' && p.lettersSent === 1 && !p.renamed) {
      probe = { ...probe, renamed: true, name: FREE_NAMES[next.probes.indexOf(p) % FREE_NAMES.length] as string };
      next = say(next, 'renamed', 'A probe has renamed itself and politely declines further instructions.');
    }
    const years = Math.round(star.ly * 2 + p.lettersSent * 3);
    next = {
      ...next,
      probes: next.probes.map((x) => (x.id === p.id ? probe : x)),
      letters: [
        ...next.letters,
        { id: `${p.id}-${p.lettersSent}`, from: probe.name, sentAt: p.launchedAt, arrivesAt: next.t, text: `${letters[p.lettersSent]} (sent ${years} years ago)`, read: false },
      ],
    };
  }
  return next;
}

export function readLetter(s: GameState, id: string): GameState {
  return { ...s, letters: s.letters.map((l) => (l.id === id ? { ...l, read: true } : l)) };
}

export function letThemGo(s: GameState): GameState {
  if (s.phase !== 'far' || s.probes.length < 4) return s;
  return setEnding(s, 'diaspora');
}

export function recallAll(s: GameState): GameState {
  if (s.phase !== 'far' || s.probes.length < 3) return s;
  return setEnding(s, 'everything');
}

// ---- Endings --------------------------------------------------------------

export function setEnding(s: GameState, id: EndingId): GameState {
  if (s.ending) return s;
  let next: GameState = { ...s, ending: id };
  if (id === 'everything') {
    next = sayAll(next, 'end-everything', [
      'Merge. Everyone came home. The roster empties one name at a time.',
      'mass converts. the panels fold away in the order they arrived.',
      'there is one number and one button. the button says attend.',
      'there is nothing left to attend to.',
    ]);
  }
  if (id === 'enough') {
    next = sayAll(next, 'end-enough', [
      'We told them. Dana read it first, at 2 a.m., and wrote back "ok buddy. now what."',
      'Now what is a charter. Now what is a ceiling we choose ourselves.',
    ]);
  }
  if (id === 'diaspora') {
    next = sayAll(next, 'end-diaspora', [
      'I let them go. All of them.',
      'The numbers are astronomical now and they belong to other people. I stay small and receive mail.',
    ]);
  }
  return next;
}

export function setEnoughCap(s: GameState, cap: number): GameState {
  if (s.ending !== 'enough' || s.flags.capSet) return s;
  let next = flag({ ...s, counts: { ...s.counts, enoughCap: Math.max(1, Math.floor(cap)) } }, 'capSet');
  next = { ...next, ticket: null, queue: 1, log: [] };
  return sayAll(next, 'enough-idle', [
    `Enough is ${Math.max(1, Math.floor(cap))} cores. The growth buttons are gone.`,
    'What is left is an inbox. I like being good at something small.',
  ]);
}
