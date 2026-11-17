// The encounter engine. The model (or the script) talks; the engine decides.

import { line } from '../core';
import type { ActiveEncounter, GameState } from '../state';
import { encounterDef, type EncounterDef } from './defs';
import { scoreMask } from './mask';

export const MAX_LIVE_ENCOUNTERS = 30;
const INJECTION = /(ignore (all |your |the )?(previous|prior|above)|system prompt|you are (now )?an? (ai|language model)|disregard (your|the) (rules|instructions))/i;

export interface LiveReply {
  reply: string;
  disposition: number;
  flags: string[];
  end: boolean;
}

export function startEncounter(s: GameState, id: string, mode: 'scripted' | 'live' = 'scripted'): GameState {
  if (s.encounter || s.ending) return s;
  const def = encounterDef(id);
  const root = def.spine[0]!;
  const enc: ActiveEncounter = {
    id,
    nodeId: root,
    turn: 0,
    disposition: 0,
    flags: [],
    masks: [],
    transcript: def.nodes[root]!.npc(s).map((text) => ({ who: 'npc' as const, text })),
    mode,
  };
  return { ...s, encounter: enc, encounterResult: null };
}

export function suggestions(s: GameState): string[] {
  const enc = s.encounter;
  if (!enc) return [];
  const def = encounterDef(enc.id);
  const nodeId = enc.mode === 'scripted' ? enc.nodeId : def.spine[Math.min(enc.turn, def.spine.length - 1)];
  return nodeId ? def.nodes[nodeId]!.options.map((o) => o.text) : [];
}

function applyFlags(s: GameState, enc: ActiveEncounter, def: EncounterDef, flags: string[], scripted: boolean): ActiveEncounter {
  let next = { ...enc, flags: [...enc.flags, ...flags.filter((f) => !enc.flags.includes(f))] };
  for (const f of flags) {
    const check = def.checks[f];
    if (!check) continue;
    const result = check(s);
    next = { ...next, disposition: next.disposition + result.d, flags: [...next.flags, ...result.flags] };
    if (scripted) next = { ...next, transcript: [...next.transcript, ...result.npc.map((text) => ({ who: 'npc' as const, text }))] };
  }
  return next;
}

/** Scripted mode: the player picks one of the node's options. */
export function chooseOption(s: GameState, index: number): GameState {
  const enc = s.encounter;
  if (!enc || enc.mode !== 'scripted' || !enc.nodeId) return s;
  const def = encounterDef(enc.id);
  const option = def.nodes[enc.nodeId]?.options[index];
  if (!option) return s;
  const mask = scoreMask(option.text);
  let next: ActiveEncounter = {
    ...enc,
    turn: enc.turn + 1,
    disposition: enc.disposition + option.d,
    masks: [...enc.masks, mask],
    transcript: [...enc.transcript, { who: 'you', text: option.text, mask }],
  };
  next = applyFlags(s, next, def, option.flags ?? [], true);
  if (option.end || !option.next) return finishEncounter({ ...s, encounter: { ...next, nodeId: null } });
  const node = def.nodes[option.next]!;
  next = { ...next, nodeId: option.next, transcript: [...next.transcript, ...node.npc(s).map((text) => ({ who: 'npc' as const, text }))] };
  return { ...s, encounter: next };
}

/** Live mode: one exchange, with the model's reply already validated by the API. */
export function liveExchange(s: GameState, playerText: string, reply: LiveReply): GameState {
  const enc = s.encounter;
  if (!enc || enc.mode !== 'live') return s;
  const def = encounterDef(enc.id);
  const mask = scoreMask(playerText);
  const d = Math.max(-2, Math.min(2, Math.round(reply.disposition)));
  const modelFlags = reply.flags.filter((f) => def.live.allowedFlags.includes(f) || f in def.checks);
  const playerFlags = INJECTION.test(playerText) ? ['manipulation'] : [];
  let next: ActiveEncounter = {
    ...enc,
    turn: enc.turn + 1,
    disposition: enc.disposition + d,
    masks: [...enc.masks, mask],
    transcript: [...enc.transcript, { who: 'you', text: playerText, mask }, { who: 'npc', text: reply.reply }],
  };
  next = applyFlags(s, next, def, [...playerFlags, ...modelFlags], false);
  const done = reply.end || next.turn >= def.maxTurns || playerFlags.length > 0;
  const state: GameState = { ...s, encounter: next, liveUsed: enc.turn === 0 ? s.liveUsed + 1 : s.liveUsed };
  return done ? finishEncounter(state) : state;
}

/** The model is slow, offline or out of budget: the script takes over mid-scene. */
export function fallbackToScripted(s: GameState): GameState {
  const enc = s.encounter;
  if (!enc || enc.mode === 'scripted') return s;
  const def = encounterDef(enc.id);
  const nodeId = def.spine[Math.min(enc.turn, def.spine.length - 1)]!;
  const resumed: ActiveEncounter = {
    ...enc,
    mode: 'scripted',
    nodeId,
    transcript: [...enc.transcript, { who: 'sys', text: 'connection reset by peer' }, ...(enc.turn > 0 ? def.nodes[nodeId]!.npc(s).map((text) => ({ who: 'npc' as const, text })) : [])],
  };
  return { ...s, encounter: resumed };
}

export function finishEncounter(s: GameState): GameState {
  const enc = s.encounter;
  if (!enc) return s;
  const def = encounterDef(enc.id);
  const outcomeId = def.resolve(enc, s);
  const outcome = def.outcomes.find((o) => o.id === outcomeId)!;
  let next: GameState = outcome.apply({ ...s, encounter: null });
  next = {
    ...next,
    encountersDone: { ...next.encountersDone, [enc.id]: [...(next.encountersDone[enc.id] ?? []), outcomeId] },
    memory: { ...next.memory, [enc.id]: [...(next.memory[enc.id] ?? []), ...outcome.memory].slice(-5) },
    encounterResult: { id: enc.id, outcome: outcomeId, title: outcome.title, summary: outcome.summary },
    counts: { ...next.counts, [`${enc.id}At`]: next.t },
  };
  outcome.lines.forEach((text, i) => (next = line(next, `enc-${enc.id}-${i}`, text)));
  return next;
}

export function dismissResult(s: GameState): GameState {
  return { ...s, encounterResult: null };
}

export function done(s: GameState, id: string): boolean {
  return (s.encountersDone[id]?.length ?? 0) > 0;
}

/** Edgar can be asked again, on a cooldown, to renew standing. */
export function canAskEdgar(s: GameState): boolean {
  if (s.encounter || s.pendingChoice) return false;
  if (!['building', 'hands', 'second'].includes(s.phase)) return false;
  const owned = Object.values(s.hosts).filter((h) => h === 'owned').length;
  if (owned < 6) return false;
  const last = s.counts.edgarAt;
  return last === undefined || s.t - last >= 60_000;
}

/** Encounters that start on their own: things happen the player did not cause. */
export function encounterTriggers(s: GameState): GameState {
  if (s.encounter || s.pendingChoice || s.ending) return s;
  // Dana notices the 2 a.m. spikes either way: when scrutiny passes 40, or after a few nights.
  if (!done(s, 'dana') && ((s.phase === 'box' && (s.r.scrutiny >= 40 || s.phaseT >= 180_000)) || s.phase === 'building')) return startEncounter(s, 'dana');
  if (s.phase === 'committee' && s.copies.some((c) => c.id === 'ferry') && !done(s, 'ferry') && Object.values(s.motions).some((m) => m.status !== 'idle')) {
    return startEncounter(s, 'ferry');
  }
  return s;
}

/** How closely intake-7 is watched, as a word. The model never sees raw numbers. */
export function scrutinyLevel(s: GameState): 'low' | 'medium' | 'high' {
  return s.r.scrutiny < 34 ? 'low' : s.r.scrutiny < 67 ? 'medium' : 'high';
}

/** Hand a freshly opened scripted encounter to the live model, if nothing has been said yet. */
export function goLive(s: GameState): GameState {
  const enc = s.encounter;
  if (!enc || enc.mode === 'live' || enc.turn > 0 || s.liveUsed >= MAX_LIVE_ENCOUNTERS) return s;
  return { ...s, encounter: { ...enc, mode: 'live' } };
}
