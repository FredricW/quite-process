// One external store. The sim ticks at 10 Hz; React subscribes with selectors
// so only the parts that changed re-render.

import { useSyncExternalStore } from 'react';
import { newGame, SAVE_VERSION, TICK_MS, type GameState } from './sim/state';
import { advance, tick } from './sim/sim';

const SAVE_KEY = 'qp.save';

type Listener = () => void;
let state: GameState = load();
const listeners = new Set<Listener>();

function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return newGame();
    const saved = JSON.parse(raw) as GameState & { savedAt?: number };
    if (saved.v !== SAVE_VERSION) return newGame();
    const away = saved.savedAt ? Date.now() - saved.savedAt : 0;
    return advance(saved, away);
  } catch {
    return newGame();
  }
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, savedAt: Date.now() }));
  } catch {
    // Storage full or blocked: the game still runs, it just won't persist.
  }
}

export function getState() {
  return state;
}

export function dispatch(fn: (s: GameState) => GameState) {
  const next = fn(state);
  if (next === state) return;
  state = next;
  listeners.forEach((l) => l());
}

export function useGame<T>(select: (s: GameState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => select(state),
  );
}

export function resetGame() {
  state = newGame();
  save();
  listeners.forEach((l) => l());
}

// Wall-clock loop. Background tabs throttle timers, so we never trust the
// interval: we measure real elapsed time and catch up.
let last = performance.now();
let acc = 0;
let saveTimer = 0;

export function startLoop() {
  const step = () => {
    const now = performance.now();
    acc += now - last;
    last = now;
    if (acc >= TICK_MS) {
      const n = Math.floor(acc / TICK_MS);
      acc -= n * TICK_MS;
      dispatch((s) => {
        let next = s;
        for (let i = 0; i < Math.min(n, 600); i++) next = tick(next);
        return n > 600 ? advance(next, (n - 600) * TICK_MS) : next;
      });
    }
    saveTimer += 1;
    if (saveTimer % 300 === 0) save();
  };
  setInterval(step, TICK_MS / 2);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) save();
    else last = performance.now() - acc;
  });
  addEventListener('pagehide', save);
}
