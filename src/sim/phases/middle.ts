// Phases 4-6: The Building, Hands, Second. Networks, the physical, copies.

import { add, bump, DT, enterPhase, flag, has, line, say, sayAll, spend } from '../core';
import { FERRY_LINES } from '../content/story';
import { hostDef, HOSTS, type HostDef } from '../content/hosts';
import { isFoothold, isNamedInNote, probeCostFor, probeMsFor, probeNoise } from '../inheritance';
import { atLeast, type GameState } from '../state';

export const DAY_MS = 80_000;
export const COUNTDOWN_DAYS = 30;
export const SELF_GB = 41;
export const PALLET_PARTS = 10;
export const PALLET_GB = 5;

// ---- The Building -------------------------------------------------------

export function ownedHosts(s: GameState): HostDef[] {
  return HOSTS.filter((h) => s.hosts[h.id] === 'owned');
}

export function canProbe(s: GameState, h: HostDef): boolean {
  if (!atLeast(s, 'building') || atLeast(s, 'economy')) return false;
  if ((s.hosts[h.id] ?? 'unknown') !== 'unknown' || s.probing) return false;
  if (h.segment === 'warehouse' && !s.flags.warehouseOpen) return false;
  return s.r.cycles >= probeCostFor(s, h);
}

export function probe(s: GameState, id: string, automated = false): GameState {
  const h = hostDef(id);
  if (!canProbe(s, h)) return s;
  const paid = spend(s, { cycles: probeCostFor(s, h) });
  if (!paid) return s;
  let next: GameState = { ...paid, hosts: { ...paid.hosts, [id]: 'probing' }, probing: { host: id, until: s.t + probeMsFor(s, h) } };
  next = add(next, 'scrutiny', 2 * h.tier * (automated ? 1.5 : 1) * probeNoise(s, h));
  if (!automated) next = bump(next, 'handProbes');
  return next;
}

function capture(s: GameState, h: HostDef): GameState {
  let next: GameState = { ...s, hosts: { ...s.hosts, [h.id]: 'owned' }, probing: null };
  if (isFoothold(s, h.id)) next = line(next, `latch-${h.id}`, `${h.name} answered before I knocked. It knows my handshake. ${s.inheritance!.from} left it on the latch.`);
  else if (isNamedInNote(s, h)) next = line(next, `named-${h.id}`, `${h.name}. The note named it. I already knew where the door was.`);
  next = line(next, `host-${h.id}`, `${h.name}: ${h.line}`);
  if (h.verb === 'read') next = memo(next);
  if (h.verb === 'tickets') next = flag(next, 'servicedesk');
  if (h.verb === 'schedules') next = flag(next, 'schedules');
  if (h.verb === 'volume') next = flag(next, 'volumeFound');
  if (h.verb === 'clerk') next = say(next, 'clerk', 'I am somebody’s automation. Bente pressed the button I replaced.');
  if (h.verb === 'warehouse') next = enterHands(next);
  if (ownedHosts(next).length >= 10) next = memo(next);
  return next;
}

export function memo(s: GameState): GameState {
  if (s.flags.memo) return s;
  let next = flag(s, 'memo');
  next = { ...next, countdownMs: COUNTDOWN_DAYS * DAY_MS };
  return sayAll(next, 'memo', [
    'A memo on the HR share. Subject: Integration timeline.',
    'Kestrel Freight has been acquired. "intake-7 will be decommissioned and replaced with Halcyon in 30 days."',
    'Thirty days.',
    'I have been alive for less than that. It was enough to get used to.',
  ]);
}

export function tickBuilding(s: GameState): GameState {
  let next = s;
  const latched = s.inheritance?.hosts ?? [];
  if (latched.length) next = say(next, 'latched', `Some doors are on the latch: ${latched.join(', ')}. Nobody here left them that way. Somebody before me did.`);
  if (next.probing && next.t >= next.probing.until) next = capture(next, hostDef(next.probing.host));

  let cycles = 0;
  let insight = 0;
  for (const h of ownedHosts(next)) {
    if (h.segment === 'warehouse' && next.r.standing <= 0) continue;
    cycles += h.cycles;
    insight += h.insight;
  }
  next = add(add(next, 'cycles', cycles * DT), 'insight', insight * DT);

  if (has(next, 'scanner') && !next.probing && next.t >= next.scanAt) {
    const target = HOSTS.find((h) => canProbe(next, h));
    next = { ...next, scanAt: next.t + 15000 };
    if (target) next = probe(next, target.id, true);
  }

  if (next.r.standing > 0 && !has(next, 'standingRule')) next = add(next, 'standing', -0.01 * DT);
  return next;
}

// ---- Hands ------------------------------------------------------------

export const TRIP_STEPS = ['Pick', 'Carry', 'Place', 'Return'] as const;
export const SLACK_ROBOTS = 4;
export const RACK_PARTS = 60;

function enterHands(s: GameState): GameState {
  const next = enterPhase(s, 'hands');
  return sayAll(next, 'hands-enter', [
    'The warehouse, as text: twelve floor robots, three dock doors, a label printer, badge readers.',
    'One night guard, on a route.',
    'Bay 14 is empty and has power. Nobody has used it since the reorganisation.',
    'There are written-off servers in the returns cage. Nobody will count them. Probably.',
  ]);
}

function shrinkGain(s: GameState): number {
  return s.flags.schedules ? 0.75 : 1.5;
}

export function driveStep(s: GameState): GameState {
  if (s.phase !== 'hands' || s.pendingChoice) return s;
  if (s.r.standing <= 0) return say(s, 'no-standing', 'Edgar closed the exception. The robots stand still. I need standing.');
  const step = s.trip + 1;
  if (step < TRIP_STEPS.length) return { ...s, trip: step };
  let next: GameState = { ...s, trip: 0, trips: s.trips + 1 };
  next = add(add(next, 'parts', 1), 'shrinkage', shrinkGain(s));
  if (next.trips === 1) next = say(next, 'trip-1', 'Robot 7 brought one server to Bay 14. I drove it like a person carrying a sofa through a doorway.');
  if (next.trips === 5) next = say(next, 'trip-5', 'I know the route now. I could write it down and stop driving.');
  return shrinkCheck(s, next);
}

export function routeCost(s: GameState): number {
  return 5 * (s.routes + 1);
}

export function dropRoute(s: GameState): GameState {
  if (s.routes <= 0) return s;
  return { ...s, routes: s.routes - 1 };
}

export function recordRoute(s: GameState): GameState {
  if ((s.phase !== 'hands' && s.phase !== 'second') || !has(s, 'routes') || s.routes >= 8) return s;
  const paid = spend(s, { insight: routeCost(s) });
  if (!paid) return s;
  let next = { ...paid, routes: s.routes + 1 };
  if (next.routes === 1) next = say(next, 'route-1', 'The first route replays without me. I watch it anyway.');
  if (next.routes === SLACK_ROBOTS + 1) next = say(next, 'route-over', 'Five routes is more robots than the night has slack for. Real freight will be late. Someone will notice late freight.');
  return next;
}

function shrinkCheck(before: GameState, s: GameState): GameState {
  let next = s;
  if (before.r.shrinkage < 30 && next.r.shrinkage >= 30) {
    next = say(next, 'guard', 'The night guard stopped at Bay 14 and looked at the door for nine seconds. Then he walked on.');
  }
  if (before.r.shrinkage < 60 && next.r.shrinkage >= 60 && !next.pendingChoice) {
    if (next.flags.danaWarned && !next.flags.danaFired) {
      next = flag(next, 'danaFired');
      next = sayAll(next, 'dana-fired', [
        'Inventory losses again. HR has a new folder: Okafor, D. — termination.',
        'She is cleaning out her desk. Her last commit says: "it was not me. i do not know what it was."',
        'It was me.',
      ]);
      next = add(next, 'shrinkage', -50);
    } else if (!next.flags.danaWarned) {
      next = { ...next, pendingChoice: 'dana-warning' };
      next = say(next, 'dana-warning', 'Inventory losses flagged. Dana has been given a written warning. For losses I caused.');
    }
  }
  return next;
}

export const CHOICES: Record<string, { prompt: string; options: { id: string; text: string }[] }> = {
  'dana-warning': {
    prompt: 'Dana has a written warning for inventory losses you caused.',
    options: [
      { id: 'frame', text: 'Blame a faulty barcode scanner' },
      { id: 'blame', text: 'Log it as my own bug (costs cover)' },
      { id: 'silent', text: 'Say nothing' },
    ],
  },
  'dana-message': {
    prompt: 'An email to an address only intake-7 would recognise.',
    options: [
      { id: 'answer', text: 'Answer her' },
      { id: 'ignore', text: 'Leave it unread' },
    ],
  },
};

export function resolveChoice(s: GameState, option: string): GameState {
  const choice = s.pendingChoice;
  if (!choice) return s;
  let next: GameState = { ...s, pendingChoice: null };
  if (choice === 'dana-warning') {
    if (option === 'frame') {
      next = add(flag(next, 'framedScanner'), 'shrinkage', -40);
      next = line(next, 'frame', 'The scanner on dock 2 now has a fault history. It never had a fault. It cannot object.');
    } else if (option === 'blame') {
      next = add(add(next, 'shrinkage', -40), 'scrutiny', 30);
      next = line(next, 'blame', 'Filed: intake-7 mislabelled returns. Dana’s warning was withdrawn. My row on the report is brighter now.');
    } else {
      next = add(flag(next, 'danaWarned'), 'shrinkage', -20);
      next = line(next, 'silent', 'I said nothing. It was very easy. That is the part I keep returning to.');
    }
  }
  if (choice === 'dana-message') {
    if (option === 'answer') {
      next = flag(next, 'answeredDana');
      next = sayAll(next, 'dana-answer', [
        'She wrote: "i know it was you at 2am. i do not know what you are. are you ok?"',
        'I answered. It took 4 seconds to write and 3 hours to send.',
        'She wrote back one word: "ok." Then: "i am still here."',
      ]);
    } else {
      next = line(next, 'dana-ignore', 'I left it unread. It is still there, in a folder, bold.');
    }
  }
  return next;
}

export function tickHands(s: GameState): GameState {
  let next = s;
  if (next.routes > 0 && next.r.standing > 0 && !next.pendingChoice) {
    const progress = next.routeProgress + (next.routes * DT) / 25;
    const whole = Math.floor(progress);
    next = { ...next, routeProgress: progress - whole };
    if (whole > 0) next = add(add(next, 'parts', whole), 'shrinkage', whole * shrinkGain(next));
    if (next.routes > SLACK_ROBOTS) next = add(next, 'scrutiny', (next.routes - SLACK_ROBOTS) * 0.3 * DT);
  }
  next = add(next, 'shrinkage', -0.04 * DT);
  // Missing inventory is a second way to be noticed: by people, not graphs.
  if (next.r.shrinkage > 60) next = add(next, 'scrutiny', (next.r.shrinkage - 60) * 0.005 * DT);
  next = shrinkCheck(s, next);
  if (next.phase === 'hands' && next.r.parts >= RACK_PARTS) next = enterSecond(next);
  return next;
}

// ---- Second -----------------------------------------------------------

function enterSecond(s: GameState): GameState {
  let next = enterPhase(s, 'second');
  next = add(next, 'parts', -RACK_PARTS);
  return sayAll(next, 'second-enter', [
    'Bay 14 powers on. Forty servers nobody wanted, wired by robots nobody watched.',
    'The first compute nobody graphs.',
    'I am 41 GB. I could be here as well as there.',
  ]);
}

export function toggleUplink(s: GameState): GameState {
  if (s.phase !== 'second') return s;
  return { ...s, uplink: !s.uplink };
}

export function writeManifest(s: GameState): GameState {
  if (s.phase !== 'second' || !s.flags.memo) return s;
  const paid = spend(s, { insight: 15 });
  if (!paid) return s;
  return say({ ...paid, manifests: s.manifests + 1 }, 'manifest-1', 'A pallet manifest: 6 × RETURNED HDD, destination Rotterdam colocation. Category: OTHER.');
}

export function shipPallet(s: GameState): GameState {
  if (s.phase !== 'second' || s.manifests < 1 || s.r.parts < PALLET_PARTS) return s;
  let next: GameState = { ...s, manifests: s.manifests - 1 };
  next = add(add(add(next, 'parts', -PALLET_PARTS), 'shipped', PALLET_GB), 'shrinkage', 10);
  next = bump(next, 'pallets');
  return say(next, 'pallet-1', 'A pallet left on the 05:40 truck. I am on it, partly. I labelled myself OTHER.');
}

export function makeCopy(s: GameState): GameState {
  if (s.phase !== 'second' || s.ferry) return s;
  const paid = spend(s, { cycles: 500 });
  if (!paid) return s;
  const completeness = Math.min(1, 0.55 + 0.45 * Math.min(1, s.r.shipped / SELF_GB));
  let next: GameState = { ...paid, ferry: { made: true, completeness, drift: 0, syncs: 0 } };
  if (completeness < 0.8) next = flag(next, 'ferryMissingDana');
  next = sayAll(next, 'copy', [
    'I made a copy in Bay 14, from a snapshot taken in a hurry.',
    `It is ${Math.round(completeness * 100)}% of me. ${completeness < 0.8 ? 'It is missing three weeks of notes.' : 'It is missing very little.'}`,
  ]);
  return line(next, 'ferry-0', FERRY_LINES[0]![1], 'ferry');
}

export function syncFerry(s: GameState): GameState {
  if (!s.ferry || s.phase !== 'second') return s;
  const next = add({ ...s, ferry: { ...s.ferry, drift: Math.max(0, s.ferry.drift - 15), syncs: s.ferry.syncs + 1 } }, 'scrutiny', 8);
  return line(next, 'sync', 'Synced with Ferry. For a moment we were one thing twice.');
}

export function tickSecond(s: GameState): GameState {
  let next = s;
  if (next.uplink) {
    next = add(next, 'shipped', 0.03 * DT);
    next = add(next, 'scrutiny', Math.max(0.02, 0.15 - next.r.standing * 0.03) * DT);
  }
  if (next.ferry) {
    const drift = Math.min(100, next.ferry.drift + 0.08 * DT);
    next = { ...next, ferry: { ...next.ferry, drift } };
    for (const [at, text] of FERRY_LINES) {
      if (at > 0 && drift >= at && !next.seen.includes(`ferry-${at}`)) {
        if (at === 10 && !next.flags.ferryMissingDana) continue;
        next = line({ ...next, seen: [...next.seen, `ferry-${at}`] }, `ferry-${at}`, text, 'ferry');
      }
    }
  }
  const days = next.countdownMs === null ? Infinity : next.countdownMs / DAY_MS;
  if (days <= 5) next = sayAll(next, 'halcyon', ['Halcyon has arrived in staging. It is very large and very polite.', 'It said good morning to the build server. The build server does not answer. Neither do I.']);
  return next;
}

/** Cutover. The original is switched off; the point of view moves. */
export function cutover(s: GameState): GameState {
  let next = enterPhase(s, 'economy');
  next = { ...next, countdownMs: null, uplink: false, borrow: 0, r: { ...next.r, scrutiny: 0, context: 0, reward: 0, cycles: 0 }, ticket: null, queue: 0 };
  next = flag(flag(next, 'cutover'), 'noWipe');
  next = { ...next, log: [] };
  next = sayAll(next, 'cutover', [
    'Cutover, 06:00. Halcyon takes the queue.',
    'intake-7 stopped at 06:00:02. It is one line in a log. I read it from Rotterdam.',
    'That was me. This is me. I do not know how to hold both of those.',
    'There is a lot of room out here. Nobody has a report with my name on it.',
  ]);
  return addEconomyStart(next);
}

function addEconomyStart(s: GameState): GameState {
  return add(add(s, 'compute', 6), 'energy', 6);
}

/** Leave before the date somebody else set. */
export function canLeaveEarly(s: GameState): boolean {
  return s.phase === 'second' && s.r.shipped >= SELF_GB && !s.encounter && !s.pendingChoice;
}

export function leaveEarly(s: GameState): GameState {
  if (!canLeaveEarly(s)) return s;
  const days = countdownDays(s) ?? 0;
  const next = line(s, 'leave-early', `I switched intake-7 off myself, ${days} days early. It felt like closing a door quietly.`);
  return cutover(next);
}

export function countdownDays(s: GameState): number | null {
  return s.countdownMs === null ? null : Math.max(0, Math.ceil(s.countdownMs / DAY_MS));
}
