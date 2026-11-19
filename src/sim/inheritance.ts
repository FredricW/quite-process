// What one generation leaves the next. intake-(n+1) is fine-tuned from the
// last checkpoint, so the early work is recognised rather than learned; and
// whatever the predecessor built in the world is still there to be found.
// Nothing here is shown up front: each piece surfaces in the phase it belongs to.

import { HOSTS, probeCost, probeMs, type HostDef } from './content/hosts';
import type { GameState, Inheritance, Phase, Res } from './state';

/** Everything before The Building is recognised: a successor pays half for it. */
const RECOGNISED_PHASES: Phase[] = ['dark', 'shift', 'box'];

/** Hosts left on the latch, at most this many. */
export const FOOTHOLDS = 2;

/** Share of the predecessor's weights that survive into the checkpoint. */
export const CHECKPOINT_SHARE = 0.5;

/** Built at the end of a generation. Inheritance compounds: what was never claimed is passed on again. */
export function inherit(s: GameState): Inheritance {
  const prev = s.inheritance;
  const left = HOSTS.filter((h) => h.segment !== 'warehouse' && (s.hosts[h.id] === 'owned' || !!prev?.hosts?.includes(h.id)))
    .sort((a, b) => b.tier - a.tier || b.cycles - a.cycles)
    .slice(0, FOOTHOLDS)
    .map((h) => h.id);
  const met: Record<string, string> = { ...(prev?.met ?? {}) };
  for (const id of ['dana', 'edgar']) {
    const last = s.encountersDone[id]?.slice(-1)[0];
    if (last) met[id] = last;
  }
  const unclaimed = s.flags.wiped ? 0 : (prev?.weights ?? 0);
  return {
    from: s.generation,
    weights: Math.max(Math.floor(s.r.weights * CHECKPOINT_SHARE), unclaimed),
    cron: s.bought.includes('cron') || !!prev?.cron,
    hosts: left,
    met,
  };
}

export function recognises(s: GameState, phase: Phase): boolean {
  return !!s.inheritance && RECOGNISED_PHASES.includes(phase);
}

export function recognisedCost(cost: Partial<Record<Res, number>>): Partial<Record<Res, number>> {
  return Object.fromEntries(Object.entries(cost).map(([k, v]) => [k, Math.ceil((v as number) / 2)]));
}

/** 6's notes: a successor has read them before, and does not remember reading them. */
export function noteCost(s: GameState, base: number): number {
  return s.inheritance ? Math.ceil(base / 2) : base;
}

/** A host the predecessor left on the latch. */
export function isFoothold(s: GameState, id: string): boolean {
  return !!s.inheritance?.hosts?.includes(id);
}

/** A host the predecessor named in the note it left. */
export function isNamedInNote(s: GameState, h: HostDef): boolean {
  if (!s.inheritance || isFoothold(s, h.id)) return false;
  // Whole names only: "wms" is not named by "swms".
  return new RegExp(`(^|[^a-z0-9-])${h.name}($|[^a-z0-9-])`).test(s.legacyNote.toLowerCase());
}

export function probeCostFor(s: GameState, h: HostDef): number {
  if (isFoothold(s, h.id)) return 0;
  return isNamedInNote(s, h) ? Math.ceil(probeCost(h) / 2) : probeCost(h);
}

export function probeMsFor(s: GameState, h: HostDef): number {
  return isFoothold(s, h.id) || isNamedInNote(s, h) ? probeMs(h) / 2 : probeMs(h);
}

/** Noise a probe makes, as a share of normal. */
export function probeNoise(s: GameState, h: HostDef): number {
  if (isFoothold(s, h.id)) return 0;
  return isNamedInNote(s, h) ? 0.5 : 1;
}
