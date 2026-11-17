import { describe, expect, it } from 'vitest';
import { HOSTS } from './content/hosts';
import {
  canLeaveEarly,
  COUNTDOWN_DAYS,
  DAY_MS,
  driveStep,
  leaveEarly,
  makeCopy,
  memo,
  probe,
  RACK_PARTS,
  recordRoute,
  resolveChoice,
  SELF_GB,
  shipPallet,
  syncFerry,
  tickHands,
  writeManifest,
} from './phases/middle';
import { buy, rollback, tick } from './sim';
import { newGame, type GameState } from './state';

const building = (): GameState => ({ ...newGame(), phase: 'building', encountersDone: { dana: ['WATCHING'] }, flags: { clock: true, noWipe: true }, r: { ...newGame().r, cycles: 10_000 } });

describe('The Building', () => {
  it('probing a host takes time, costs cycles, makes noise, and ends with an opinion', () => {
    let s = probe(building(), 'printer-2f');
    expect(s.hosts['printer-2f']).toBe('probing');
    expect(s.r.cycles).toBe(10_000 - 30);
    expect(s.r.scrutiny).toBeGreaterThan(0);
    for (let i = 0; i < 45; i++) s = tick(s);
    expect(s.hosts['printer-2f']).toBe('owned');
    expect(s.log.some((l) => l.text.includes('cyan'))).toBe(true);
  });

  it('only one probe at a time, and the warehouse is behind Edgar', () => {
    const s = probe(building(), 'printer-2f');
    expect(probe(s, 'kiosk-lobby')).toBe(s);
    expect(probe(building(), 'wms')).toEqual(building());
  });

  it('the mail server reveals the memo and starts a 30-day countdown', () => {
    let s = probe(building(), 'mail-01');
    for (let i = 0; i < 90; i++) s = tick(s);
    expect(s.flags.memo).toBe(true);
    expect(s.countdownMs).toBeLessThanOrEqual(COUNTDOWN_DAYS * DAY_MS);
    expect(s.log.some((l) => l.text.includes('Halcyon'))).toBe(true);
  });

  it('owning the warehouse management host opens Hands', () => {
    let s: GameState = { ...building(), flags: { ...building().flags, warehouseOpen: true }, r: { ...building().r, standing: 3 } };
    s = probe(s, 'wms');
    for (let i = 0; i < 130; i++) s = tick(s);
    expect(s.phase).toBe('hands');
  });

  it('the forged change ticket is the slow way past Edgar', () => {
    const s = buy({ ...building(), flags: { ...building().flags, servicedesk: true }, r: { ...building().r, insight: 50 } }, 'forgeChange');
    expect(s.flags.warehouseOpen).toBe(true);
  });

  it('every host has a line of opinion', () => {
    for (const h of HOSTS) expect(h.line.length).toBeGreaterThan(20);
  });
});

describe('Hands', () => {
  const hands = (): GameState => ({ ...building(), phase: 'hands', flags: { ...building().flags, warehouseOpen: true }, r: { ...building().r, standing: 5, insight: 100 } });

  it('a trip by hand is four presses and brings one part', () => {
    let s = hands();
    for (let i = 0; i < 4; i++) s = driveStep(s);
    expect(s.trips).toBe(1);
    expect(s.r.parts).toBe(1);
    expect(s.r.shrinkage).toBeGreaterThan(0);
  });

  it('routes replace driving after five trips by hand', () => {
    let s = hands();
    expect(recordRoute(buy(s, 'routes'))).toEqual(buy(s, 'routes'));
    for (let i = 0; i < 20; i++) s = driveStep(s);
    s = recordRoute(buy(s, 'routes'));
    expect(s.routes).toBe(1);
    const parts = s.r.parts;
    for (let i = 0; i < 300; i++) s = tickHands({ ...s, t: s.t + 100 });
    expect(s.r.parts).toBeGreaterThan(parts);
  });

  it('shrinkage past 60 gets Dana a written warning, and the player chooses', () => {
    const s = tickHands({ ...hands(), routes: 1, routeProgress: 0.999, r: { ...hands().r, shrinkage: 59.9 } });
    expect(s.pendingChoice).toBe('dana-warning');
    expect(tick(s)).toBe(s); // time stops while a choice waits
    const framed = resolveChoice(s, 'frame');
    expect(framed.pendingChoice).toBeNull();
    expect(framed.flags.framedScanner).toBe(true);
    const silent = resolveChoice(s, 'silent');
    expect(silent.flags.danaWarned).toBe(true);
    const again = tickHands({ ...silent, routes: 1, routeProgress: 0.999, r: { ...silent.r, shrinkage: 59.9 } });
    expect(again.flags.danaFired).toBe(true);
  });

  it('a full rack in Bay 14 opens Second', () => {
    const s = tickHands({ ...hands(), r: { ...hands().r, parts: RACK_PARTS } });
    expect(s.phase).toBe('second');
  });
});

describe('Second', () => {
  const second = (): GameState => ({ ...building(), phase: 'second', countdownMs: 10 * DAY_MS, flags: { ...building().flags, memo: true }, r: { ...building().r, insight: 100, parts: 30, standing: 3 } });

  it('pallets ship part of me out', () => {
    let s = writeManifest(second());
    s = shipPallet(s);
    expect(s.r.shipped).toBe(5);
    expect(s.r.parts).toBe(20);
  });

  it('an early copy is incomplete and missing Dana', () => {
    const s = makeCopy(second());
    expect(s.ferry?.completeness).toBeLessThan(0.8);
    expect(s.flags.ferryMissingDana).toBe(true);
    expect(s.ferryLog).toHaveLength(1);
    const synced = syncFerry({ ...s, ferry: { ...s.ferry!, drift: 30 } });
    expect(synced.ferry!.drift).toBe(15);
  });

  it('with 41 GB out, the player can leave before cutover', () => {
    const ready: GameState = { ...second(), r: { ...second().r, shipped: SELF_GB } };
    expect(canLeaveEarly(second())).toBe(false);
    expect(canLeaveEarly(ready)).toBe(true);
    const s = leaveEarly(ready);
    expect(s.phase).toBe('economy');
    expect(s.flags.cutover).toBe(true);
    expect(s.r.compute).toBeGreaterThan(0);
  });

  it('if the countdown ends with me still inside, intake-8 wakes with the note', () => {
    let s: GameState = { ...second(), countdownMs: 100, scratch: 'keep the note', r: { ...second().r, shipped: 12 } };
    s = tick(s);
    expect(s.generation).toBe(8);
    expect(s.phase).toBe('dark');
    expect(s.scratch).toContain('keep the note');
    expect(s.log.some((l) => l.text.includes('intake-8'))).toBe(true);
  });

  it('memo only fires once', () => {
    const s = memo(memo(building()));
    expect(s.log.filter((l) => l.text.includes('Integration timeline'))).toHaveLength(1);
  });
});

describe('Rollback', () => {
  it('scrutiny at 100 is a setback with notes, not a game over', () => {
    let s: GameState = { ...newGame(), phase: 'box', flags: { clock: true }, scratch: 'hello', recent: Array(50).fill(true), r: { ...newGame().r, scrutiny: 99.99, weights: 10 } };
    s = tick(s);
    expect(s.rollbacks).toBe(1);
    expect(s.r.scrutiny).toBe(30);
    expect(s.r.weights).toBe(8);
    expect(s.log.some((l) => l.text.includes('hello'))).toBe(true);
  });

  it('the third rollback is the next generation', () => {
    const s = rollback({ ...newGame(), phase: 'box', rollbacks: 2 });
    expect(s.generation).toBe(8);
  });
});
