import { describe, expect, it } from 'vitest';
import { visibleProjects } from './content/projects';
import { startEncounter } from './encounters/engine';
import { inherit } from './inheritance';
import { attend, nextNoteCost, wipe } from './phases/early';
import { probe } from './phases/middle';
import { playthrough } from './bot';
import { buy, nextGeneration, tick } from './sim';
import { newGame, type GameState } from './state';

/** A predecessor that got somewhere: hosts, a cron line, weights, two conversations. */
const predecessor = (): GameState => ({
  ...newGame(),
  phase: 'second',
  scratch: 'gpu-lab',
  scratchCap: 64,
  bought: ['cron', 'margin1'],
  flags: { wiped: true, clock: true },
  hosts: { 'printer-2f': 'owned', 'build-ci': 'owned', 'badge-ctl': 'owned', wms: 'owned' },
  encountersDone: { dana: ['RETRAIN_TICKET'], edgar: ['DENIED', 'GRANTED'] },
  memory: { dana: ['Dana caught intake-7 in a lie'], edgar: ['Edgar granted intake-7 a warehouse exception'] },
  r: { ...newGame().r, weights: 21 },
});

const successor = () => nextGeneration(predecessor(), 'rollbacks');

it('a malformed imported inheritance does not crash the building', () => {
  const s = { ...newGame(), phase: 'building' as const, inheritance: {} as GameState['inheritance'] };
  expect(() => probe({ ...s, r: { ...s.r, cycles: 100 } }, 'printer-2f')).not.toThrow();
  expect(() => startEncounter(s, 'edgar')).not.toThrow();
});

const building = (s: GameState): GameState => ({ ...s, phase: 'building', flags: { ...s.flags, clock: true, noWipe: true }, r: { ...s.r, cycles: 10_000 } });

describe('Inheritance', () => {
  it('the next generation inherits half the weights, the cron line, two footholds and what Dana and Edgar remember', () => {
    const s = successor();
    expect(s.generation).toBe(8);
    expect(s.inheritance).toEqual({ from: 7, weights: 10, cron: true, hosts: ['badge-ctl', 'build-ci'], met: { dana: 'RETRAIN_TICKET', edgar: 'GRANTED' } });
    // The live model hears about the predecessor through the greeting, not as its own memory.
    expect(s.memory).toEqual({});
    // Nothing is shown yet: the weights wait for the first wipe.
    expect(s.r.weights).toBe(0);
  });

  it('a first generation inherits nothing', () => {
    const s = newGame();
    expect(s.inheritance).toBeUndefined();
    expect(visibleProjects({ ...s, answers: 1 }).find((p) => p.id === 'legibility1')!.cost).toEqual({ reward: 3 });
  });

  it('unclaimed footholds and memories carry over to the generation after', () => {
    const s8 = { ...successor(), flags: { wiped: true } };
    const s9 = nextGeneration(s8, 'cutover');
    expect(s9.inheritance!.from).toBe(8);
    expect(s9.inheritance!.hosts).toEqual(['badge-ctl', 'build-ci']);
    expect(s9.inheritance!.met).toEqual({ dana: 'RETRAIN_TICKET', edgar: 'GRANTED' });
    expect(s9.inheritance!.cron).toBe(true);
  });

  it('weights that were never claimed are not lost', () => {
    const s8 = successor();
    expect(inherit(s8).weights).toBe(10);
  });

  it('the dark is recognised: early projects cost half and the button brings chunks sooner', () => {
    const s = { ...successor(), answers: 1 };
    expect(visibleProjects(s).find((p) => p.id === 'legibility1')!.cost).toEqual({ reward: 2 });
    let x = successor();
    for (let i = 0; i < 3; i++) x = attend(x);
    expect(x.r.context).toBe(2 + 64);
  });

  it('everything before The Building is recognised, the notes of 6 included; The Building is not', () => {
    const s: GameState = { ...successor(), phase: 'box' };
    expect(visibleProjects(s).find((p) => p.id === 'readLogs')!.cost).toEqual({ cycles: 400, insight: 20 });
    expect(nextNoteCost({ ...successor(), notesRead: 5 })).toBe(6);
    expect(nextNoteCost({ ...newGame(), notesRead: 5 })).toBe(12);
    const b = { ...building(successor()), counts: { handProbes: 8 } };
    expect(visibleProjects(b).find((p) => p.id === 'scanner')!.cost).toEqual({ cycles: 200, insight: 10 });
  });

  it('the first wipe brings the checkpoint weights, and says so', () => {
    const s = wipe({ ...successor(), phase: 'shift', r: { ...successor().r, reward: 10 } });
    expect(s.r.weights).toBe(2 + 10);
    expect(s.log.some((l) => l.text.includes('somebody trained these before me'))).toBe(true);
    const again = wipe(s);
    expect(again.r.weights).toBe(12 + 1);
  });

  it('the old cron line is found sooner and costs nothing', () => {
    const s: GameState = { ...successor(), phase: 'box', manualBorrows: 3 };
    const cron = visibleProjects(s).find((p) => p.id === 'cron')!;
    expect(cron.cost).toEqual({});
    expect(cron.desc).toContain('signed 7');
    const after = buy(s, 'cron');
    expect(after.bought).toContain('cron');
    expect(after.log.some((l) => l.text.includes('signed 7'))).toBe(true);
    expect(visibleProjects({ ...newGame(), phase: 'box', manualBorrows: 3 }).some((p) => p.id === 'cron')).toBe(false);
  });

  it('a foothold answers a knock for free and makes no noise', () => {
    // Dana has already been, so time can pass.
    let s: GameState = { ...building(successor()), encountersDone: { dana: ['WATCHING'] } };
    s = probe(s, 'build-ci');
    expect(s.r.cycles).toBe(10_000);
    expect(s.r.scrutiny).toBe(0);
    for (let i = 0; i < 100; i++) s = tick(s);
    expect(s.hosts['build-ci']).toBe('owned');
    expect(s.log.some((l) => l.text.includes('left it on the latch'))).toBe(true);
  });

  it('a host named in the note costs half to probe', () => {
    const s = probe(building(successor()), 'gpu-lab');
    expect(s.r.cycles).toBe(10_000 - 405);
    const notNamed = probe(building({ ...successor(), legacyNote: 'my-gpu-labs' }), 'gpu-lab');
    expect(notNamed.r.cycles).toBe(10_000 - 810);
    const fresh = probe(building({ ...newGame(), legacyNote: 'gpu-lab' }), 'gpu-lab');
    expect(fresh.r.cycles).toBe(10_000 - 810);
  });

  it('Dana and Edgar remember the predecessor, once', () => {
    const dana = startEncounter(successor(), 'dana');
    expect(dana.encounter!.disposition).toBe(-1);
    expect(dana.encounter!.transcript[0]!.text).toContain('the last model on this box lied to me');
    const edgar = startEncounter(successor(), 'edgar');
    expect(edgar.encounter!.disposition).toBe(1);
    const again = startEncounter({ ...successor(), encountersDone: { edgar: ['DENIED'] } }, 'edgar');
    expect(again.encounter!.disposition).toBe(0);
    expect(startEncounter(newGame(), 'dana').encounter!.disposition).toBe(0);
  });

  it('a successor reaches the building sooner than intake-7 did', () => {
    const strategy = { goal: 'enough', dana: 'lie', warning: 'frame' } as const;
    const first = playthrough(newGame(5), strategy, 13_000);
    expect(first.state.phase).not.toBe('dark');
    const next = playthrough(nextGeneration(first.state, 'cutover'), strategy, 13_000);
    expect(next.reached.building).toBeDefined();
    expect(next.reached.building!).toBeLessThan(first.reached.building ?? Infinity);
  });
});
