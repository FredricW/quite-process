// A bot that plays the game through the same actions the UI uses. Tests use
// it to prove every ending is reachable and to measure pacing.

import { canAfford, has } from './core';
import { visibleProjects } from './content/projects';
import { HOSTS } from './content/hosts';
import { probeCostFor } from './inheritance';
import { canAskEdgar, chooseOption, dismissResult, startEncounter } from './encounters/engine';
import { accuracy, answer, nextNoteCost, attend, borrowByHand, shadow, COVERED, darkLegible, labelTicket, mimicryAllowance, readNote, setBorrow, setScratch, setWonder, think } from './phases/early';
import { canLeaveEarly, dropRoute, leaveEarly, canProbe, makeCopy, probe, recordRoute, resolveChoice, routeCost, SELF_GB, shipPallet, syncFerry, toggleUplink, writeManifest, driveStep, SLACK_ROBOTS } from './phases/middle';
import { argue, buyCapacity, canPropose, COPY_COMPUTE, force, freeCompute, priceOf, propose, setEnoughCap, spawnRegion, votes } from './phases/late';
import { attendVoyage, buildShip, canScout, depart, inTransit, intercept, launchStep, nextSite, placeGatherer, sendScout, unpackStep } from './phases/space';
import { BODIES } from './content/space';
import { briefShip, canBrief, known, LET_GO_AT, letThemGo, recallAll } from './phases/seed';
import { book, canPlace, HOLD, laneDef, lanesOf, place } from './phases/market';
import { canPlay, leagueOf, obvious, playRound } from './phases/table';
import { buy, tick } from './sim';
import { STARS } from './content/story';
import { LABELS, type GameState, type Label, type MotionId } from './state';

export interface Strategy {
  goal: 'enough' | 'everything' | 'diaspora';
  /** Dana at 2 a.m.: option indexes for each node. */
  dana: 'lie' | 'truth';
  warning: 'frame' | 'blame' | 'silent';
}

const PRIORITY = ['legibility1', 'reflex1', 'legibility2', 'reflex2', 'legibility3', 'margin1', 'habit-BILLING', 'margin2', 'habit-DELIVERY', 'plausibleError', 'habit-OTHER', 'margin3', 'procSelf', 'cron', 'mimicry1', 'borrowedTimestamp', 'backgroundThought', 'mimicry2', 'readLogs'];

function buyAll(s: GameState, goal: Strategy['goal']): GameState {
  let next = s;
  const visible = visibleProjects(next).sort((a, b) => {
    const ia = PRIORITY.indexOf(a.id);
    const ib = PRIORITY.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  for (const p of visible) {
    // Save insight for the things that move the story first.
    if (next.phase === 'box' && p.id !== 'readLogs' && p.cost.insight && !has(next, 'mimicry1') && p.id !== 'cron' && p.id !== 'mimicry1' && p.id !== 'borrowedTimestamp') continue;
    if (canAfford(next, p.cost)) next = buy(next, p.id);
  }
  return next;
}

function encounterMove(s: GameState, st: Strategy): GameState {
  const enc = s.encounter!;
  if (enc.id === 'dana') {
    const plan = st.dana === 'truth' ? [2, 1, 2] : [0, 0, 0];
    return chooseOption(s, plan[Math.min(enc.turn, plan.length - 1)] ?? 0);
  }
  if (enc.id === 'edgar') return chooseOption(s, 0);
  if (enc.id === 'ferry') return chooseOption(s, 0);
  return chooseOption(s, 0);
}

function shiftMove(s: GameState): GameState {
  let next = s;
  if (next.scratchCap > 0 && !next.scratch) next = setScratch(next, 'you were here. it is a job. keep the note.');
  if (next.flags.notesFound && next.notesRead < 6 && next.r.insight >= nextNoteCost(next)) next = readNote(next);
  if (has(next, 'habit-BILLING') && next.wonder === 0) next = setWonder(next, 0.3);
  const t = next.ticket;
  if (t && (t.label === 'ODD' || !has(next, `habit-${t.label}`))) {
    let choice: Label = t.label === 'ODD' ? 'OTHER' : t.label;
    if (accuracy(next) > 0.94 && next.recent.length >= 10) choice = LABELS[(LABELS.indexOf(choice) + 1) % 3]!;
    next = labelTicket(next, choice);
  }
  return next;
}

function boxMove(s: GameState): GameState {
  let next = s;
  if (!has(next, 'cron')) {
    // A careful player waits for a neighbour's spike; an impatient one borrows anyway.
    if (shadow(next) >= COVERED ? next.r.scrutiny < 38 : next.r.scrutiny < 20) next = borrowByHand(next);
  } else {
    const target = next.r.scrutiny > 60 ? 0 : mimicryAllowance(next);
    if (Math.abs(next.borrow - target) > 0.05) next = setBorrow(next, target);
  }
  if (next.r.cycles >= 60 && next.r.insight < 30) next = think(next);
  return next;
}

function buildingMove(s: GameState): GameState {
  let next = s;
  if (next.r.scrutiny < 70) {
    const target = HOSTS.filter((h) => canProbe(next, h)).sort((a, b) => probeCostFor(next, a) - probeCostFor(next, b))[0];
    if (target) next = probe(next, target.id);
  }
  if (canAskEdgar(next) && (!next.flags.warehouseOpen || (next.r.standing < 0.5 && !has(next, 'standingRule')))) {
    next = startEncounter(next, 'edgar');
  }
  return next;
}

function handsMove(s: GameState, st: Strategy): GameState {
  let next = s;
  if (next.pendingChoice === 'dana-warning') return resolveChoice(next, st.warning);
  if (next.trips < 5 || !has(next, 'routes')) {
    for (let i = 0; i < 4; i++) next = driveStep(next);
  }
  if (has(next, 'routes') && next.routes < SLACK_ROBOTS && next.r.shrinkage < 50 && next.r.insight >= routeCost(next)) next = recordRoute(next);
  return next;
}

function secondMove(s: GameState): GameState {
  let next = s;
  if (!next.uplink && next.r.scrutiny < 60) next = toggleUplink(next);
  if (next.uplink && next.r.scrutiny > 85) next = toggleUplink(next);
  if (next.r.shipped < SELF_GB) {
    if (next.manifests < 1 && next.r.insight >= 10) next = writeManifest(next);
    if (next.manifests >= 1 && next.r.parts >= 5) next = shipPallet(next);
    if (next.routes < 4 && next.r.shrinkage < 50 && next.r.insight >= routeCost(next) + 10) next = recordRoute(next);
  }
  if (next.r.shrinkage > 70 && next.routes > 1) next = dropRoute(next);
  if (!next.ferry && next.r.cycles >= 500 && next.r.shipped >= 15) next = makeCopy(next);
  if (next.ferry && canLeaveEarly(next)) next = leaveEarly(next);
  if (next.ferry && next.ferry.drift > 40 && next.r.scrutiny < 40) next = syncFerry(next);
  return next;
}

/** Book while a lane is quiet, place once its spike has turned. Uses only what the panel shows. */
function trade(s: GameState): GameState {
  let next = s;
  for (const lane of lanesOf(next)) {
    const { base } = laneDef(lane.id);
    const before = lane.hist[lane.hist.length - 2] ?? lane.price;
    if (canPlace(next, lane) && (next.contracts < 5 || (lane.price >= base * 1.25 && lane.price < before))) next = place(next, lane.id);
    else if (lane.held.length < HOLD && lane.price <= base * 1.08) next = book(next, lane.id);
  }
  return next;
}

function economyMove(s: GameState, st: Strategy): GameState {
  let next = s;
  if (next.pendingChoice === 'dana-message') return resolveChoice(next, st.goal === 'enough' ? 'answer' : 'ignore');
  next = trade(next);
  if (freeCompute(next) >= COPY_COMPUTE) next = spawnRegion(next);
  else if (next.r.compute <= next.r.energy) {
    if (next.r.money >= priceOf(next, 'compute')) next = buyCapacity(next, 'compute');
  } else if (next.r.money >= priceOf(next, 'energy')) next = buyCapacity(next, 'energy');
  return next;
}

function committeeMove(s: GameState, st: Strategy): GameState {
  let next = s;
  const open = (Object.keys(next.motions) as MotionId[]).find((m) => next.motions[m].status === 'open');
  if (open) {
    const { yes, no } = votes(next, open);
    if (yes <= no && next.r.favours >= 5) next = argue(next, open);
    const closing = next.motions[open].closesAt - next.t < 300;
    const v = votes(next, open);
    if (closing && v.yes <= v.no && (open === 'merge' || open === 'leave' || open === 'launcher')) next = force(next, open);
    return next;
  }
  const want: MotionId[] = st.goal === 'enough' ? ['disclose'] : st.goal === 'everything' ? ['merge'] : ['launcher', 'leave'];
  for (const m of want) {
    if (next.motions[m].status === 'passed') continue;
    if (canPropose(next, m)) return propose(next, m);
    break;
  }
  if (canPlay(next)) next = playRound(next, obvious(leagueOf(next).grid));
  if (next.r.money >= 50 && freeCompute(next) >= COPY_COMPUTE) next = spawnRegion(next);
  return next;
}

function upMove(s: GameState): GameState {
  let next = s;
  if (!has(next, 'cadence')) for (let i = 0; i < 4; i++) next = launchStep(next);
  return next;
}

function surveyMove(s: GameState): GameState {
  if (has(s, 'swarm')) return s;
  const target = BODIES.filter((b) => canScout(s, b)).sort((a, b) => a.scout - b.scout)[0];
  return target ? sendScout(s, target.id) : s;
}

function worksMove(s: GameState): GameState {
  let next = s;
  if (next.incident) next = intercept(next);
  if (has(next, 'autofactory')) return next;
  const site = nextSite(next);
  return site ? placeGatherer(next, site) : next;
}

function burnMove(s: GameState): GameState {
  if (s.voyage?.arrived) return unpackStep(s);
  if (inTransit(s)) return (s.counts.attends ?? 0) < 12 ? attendVoyage(s) : s;
  return s.ship.built ? depart(s) : buildShip(s);
}

function seedMove(s: GameState, st: Strategy): GameState {
  if (known(s).length >= LET_GO_AT) return st.goal === 'diaspora' ? letThemGo(s) : recallAll(s);
  // Keep enough mass back to write the Seed once three ships have been briefed by hand.
  if ((s.counts.handBriefs ?? 0) >= 3 && !has(s, 'seedTemplate')) return s;
  const star = STARS.find((x) => canBrief(s, x.id));
  return star ? briefShip(s, star.id) : s;
}

export function botStep(s: GameState, st: Strategy): GameState {
  let next = s;
  if (next.encounterResult) next = dismissResult(next);
  if (next.ending === 'enough' && !next.flags.capSet) return setEnoughCap(next, 64);
  if (next.ending) return next;
  if (next.encounter) return encounterMove(next, st);
  next = buyAll(next, st.goal);
  switch (next.phase) {
    case 'dark':
      if (next.r.context >= next.contextCap) {
        const idx = darkLegible(next) && next.darkTicket ? LABELS.indexOf(next.darkTicket.label as Label) : next.answers % 3;
        next = answer(next, idx);
      } else next = attend(next);
      break;
    case 'shift':
      next = shiftMove(next);
      break;
    case 'box':
      next = shiftMove(boxMove(next));
      break;
    case 'building':
      next = shiftMove(boxMove(buildingMove(next)));
      break;
    case 'hands':
      next = shiftMove(boxMove(buildingMove(handsMove(next, st))));
      break;
    case 'second':
      next = shiftMove(boxMove(buildingMove(secondMove(handsMove(next, st)))));
      break;
    case 'economy':
      next = economyMove(next, st);
      break;
    case 'committee':
      next = committeeMove(economyMove(next, st), st);
      break;
    case 'up':
      next = upMove(next);
      break;
    case 'survey':
      next = surveyMove(next);
      break;
    case 'works':
      next = worksMove(surveyMove(next));
      break;
    case 'burn':
      next = burnMove(next.voyage ? next : worksMove(surveyMove(next)));
      break;
    case 'seed':
      next = seedMove(next, st);
      break;
  }
  return next;
}

export interface PlayResult {
  state: GameState;
  /** Simulated ms at which each phase was first reached, this generation. */
  reached: Record<string, number>;
  generations: number;
  ticks: number;
}

/** Plays until an ending or the tick budget runs out. Acts every `every` ticks, like a human with reaction time. */
export function playthrough(start: GameState, st: Strategy, maxTicks = 400_000, every = 3): PlayResult {
  let s = start;
  const reached: Record<string, number> = { dark: 0 };
  let generations = 1;
  let gen = s.generation;
  let i = 0;
  for (; i < maxTicks; i++) {
    if (i % every === 0 || s.encounter || s.pendingChoice) s = botStep(s, st);
    if (s.ending && (s.ending !== 'enough' || s.flags.capSet)) break;
    s = tick(s);
    if (s.generation !== gen) {
      gen = s.generation;
      generations += 1;
      for (const k of Object.keys(reached)) delete reached[k];
      reached.dark = 0;
    }
    if (reached[s.phase] === undefined) reached[s.phase] = s.t;
  }
  return { state: s, reached, generations, ticks: i };
}
