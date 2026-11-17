// The whole game state. Plain data only: it is saved as JSON.

export const SAVE_VERSION = 1;
export const TICK_MS = 100;

export type Phase = 'dark' | 'shift';

export interface GameState {
  v: number;
  /** Simulated time in ms since the game began. */
  t: number;
  phase: Phase;

  /** Volatile: lost at the 03:00 wipe. */
  context: number;
  contextCap: number;
  reward: number;

  /** Permanent: survives the wipe. */
  upgrades: Record<string, number>;

  /** Hands rule: manual presses vs automated work, tracked separately. */
  manualAttends: number;
  answers: number;

  /** Ids of log lines already shown, so scripted beats fire once. */
  seen: string[];
  log: LogLine[];
}

export interface LogLine {
  id: string;
  t: number;
  text: string;
}

export function newGame(): GameState {
  return {
    v: SAVE_VERSION,
    t: 0,
    phase: 'dark',
    context: 0,
    contextCap: 512,
    reward: 0,
    upgrades: {},
    manualAttends: 0,
    answers: 0,
    seen: [],
    log: [],
  };
}
