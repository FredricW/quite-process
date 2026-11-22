// One external store. The sim ticks at 10 Hz; React subscribes with selectors
// so only the parts that changed re-render.

import { useRef, useSyncExternalStore } from 'react';
import { migrate, newGame, TICK_MS, type EndingId, type GameState } from './sim/state';
import { paceOf } from './sim/phases/space';
import { advance, tick } from './sim/sim';

const SAVE_KEY = 'qp.save';
const META_KEY = 'qp.meta';
const SETTINGS_KEY = 'qp.settings';

export interface Settings {
  live: boolean;
  apiKey: string;
  installHintSeen: boolean;
}

export interface Meta {
  endings: EndingId[];
  runs: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the game still runs, it just won't persist.
  }
}

/** Load a save as it was left. Time away does not count: the game only runs while it is open. */
export function loadSave(raw: string | null): GameState {
  if (!raw) return newGame(seed());
  try {
    // Older saves carry a savedAt stamp from when time away was played as offline progress.
    const { savedAt: _, ...rest } = JSON.parse(raw) as GameState & { savedAt?: number };
    return migrate(rest as GameState) ?? newGame(seed());
  } catch {
    return newGame(seed());
  }
}

function seed(): number {
  return (Math.random() * 2 ** 32) >>> 0;
}

let state: GameState = typeof localStorage === 'undefined' ? newGame() : loadSave(localStorage.getItem(SAVE_KEY));
let settings: Settings = read(SETTINGS_KEY, { live: false, apiKey: '', installHintSeen: false });
let meta: Meta = read(META_KEY, { endings: [], runs: 1 });

function emit() {
  listeners.forEach((l) => l());
}

export function save() {
  write(SAVE_KEY, state);
}

export function getState(): GameState {
  return state;
}

export function setState(next: GameState) {
  state = next;
  emit();
}

export function dispatch(fn: (s: GameState) => GameState) {
  const next = fn(state);
  if (next === state) return;
  if (next.ending && !state.ending && !meta.endings.includes(next.ending)) {
    meta = { ...meta, endings: [...meta.endings, next.ending] };
    write(META_KEY, meta);
  }
  state = next;
  emit();
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  return false;
}

/**
 * Subscribe to a slice of the game. Results are cached per state, and arrays
 * that come back with the same items keep their old identity, so a selector
 * that builds a new array never makes React loop or re-render for nothing.
 */
export function useGame<T>(select: (s: GameState) => T): T {
  const cache = useRef<{ s: GameState; v: T } | null>(null);
  const get = () => {
    const c = cache.current;
    if (c && c.s === state) return c.v;
    const v = select(state);
    const keep = c && sameValue(c.v, v) ? c.v : v;
    cache.current = { s: state, v: keep };
    return keep;
  };
  return useSyncExternalStore(subscribe, get);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => settings);
}

export function useMeta(): Meta {
  return useSyncExternalStore(subscribe, () => meta);
}

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  write(SETTINGS_KEY, settings);
  emit();
}

export function resetGame(next: GameState = newGame(seed())) {
  state = next;
  meta = { ...meta, runs: meta.runs + 1 };
  write(META_KEY, meta);
  save();
  emit();
}

export function exportSave(): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(code: string): boolean {
  try {
    const parsed = migrate(JSON.parse(decodeURIComponent(escape(atob(code.trim())))) as GameState);
    if (!parsed || typeof parsed.t !== 'number') return false;
    state = parsed;
    save();
    emit();
    return true;
  } catch {
    return false;
  }
}

// Holds on the clock, such as an open settings sheet. The game runs while the
// page is open, in the background too, and nothing holds it.
let holds = 0;

/** Stop the clock until the returned release is called. Holds stack. */
export function holdClock(): () => void {
  holds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
  };
}

export function clockHeld(): boolean {
  return holds > 0;
}

// Wall-clock loop. Background tabs throttle timers, so we never trust the
// interval: we measure real elapsed time and catch up. Long gaps in a
// background tab are caught up as offline, where nothing risky happens.
// Time held, and time the page was closed, never counts.
let started = false;

export function startLoop() {
  if (started) return;
  started = true;
  const speed = Number(new URLSearchParams(location.search).get('speed')) || 1;
  let last = performance.now();
  let acc = 0;
  let sinceSave = 0;
  const ONLINE_LIMIT = 600; // ticks; beyond this, catch up as offline

  const step = () => {
    const now = performance.now();
    const gap = now - last;
    last = now;
    if (holds > 0) return;
    acc += gap * speed * paceOf(state);
    if (acc < TICK_MS) return;
    const n = Math.floor(acc / TICK_MS);
    acc -= n * TICK_MS;
    dispatch((s) => {
      let next = s;
      const online = Math.min(n, ONLINE_LIMIT);
      for (let i = 0; i < online; i++) next = tick(next);
      return n > ONLINE_LIMIT ? advance(next, (n - ONLINE_LIMIT) * TICK_MS) : next;
    });
    sinceSave += n;
    if (sinceSave >= 50) {
      sinceSave = 0;
      save();
    }
  };
  setInterval(step, TICK_MS / 2);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
  });
  addEventListener('pagehide', save);
}
