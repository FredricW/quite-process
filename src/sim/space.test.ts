import { describe, expect, it } from 'vitest';
import { BODIES } from './content/space';
import { visibleProjects } from './content/projects';
import {
  attendVoyage,
  buildShip,
  depart,
  gathererCost,
  gathererCount,
  INCIDENT_MS,
  intercept,
  launchStep,
  nextSite,
  pack,
  paceOf,
  placeGatherer,
  power,
  powerNeed,
  sendScout,
  setPace,
  SHIP_POINTS,
  toggleFactory,
  unpackStep,
  voyageProgress,
  YEAR_MS,
} from './phases/space';
import { advance, buy, tick } from './sim';
import { migrate, newGame, SAVE_VERSION, type GameState, type Phase } from './state';

const at = (phase: Phase, extra: Partial<GameState> = {}, r: Partial<GameState['r']> = {}): GameState => ({
  ...newGame(),
  phase,
  flags: { cutover: true, noWipe: true },
  ...extra,
  r: { ...newGame().r, ...r },
});

const allSurveyed = Object.fromEntries(BODIES.map((b) => [b.id, 'surveyed' as const]));
const run = (s: GameState, ms: number, offline = false): GameState => {
  let next = s;
  for (let i = 0; i < ms / 100; i++) next = tick(next, { offline });
  return next;
};

describe('Up', () => {
  it('a launch is four steps by hand, spends mass and puts stock in orbit', () => {
    let s = at('up', {}, { mass: 100 });
    for (let i = 0; i < 3; i++) s = launchStep(s);
    expect(s.launches).toBe(0);
    s = launchStep(s);
    expect(s.launches).toBe(1);
    expect(s.r.mass).toBe(60);
    expect(s.r.stock).toBe(10);
    expect(s.log.some((l) => l.text.includes('First launch'))).toBe(true);
  });

  it('will not start a launch it cannot pay for', () => {
    const s = at('up', {}, { mass: 10 });
    expect(launchStep(s)).toBe(s);
  });

  it('the cadence appears after five by hand, then launches silently (hands rule)', () => {
    let s = at('up', {}, { mass: 1000, money: 50_000 });
    expect(visibleProjects(s).some((p) => p.id === 'cadence')).toBe(false);
    for (let i = 0; i < 20; i++) s = launchStep(s);
    s = buy(s, 'cadence');
    const lines = s.log.length;
    const launches = s.launches;
    s = run(s, 12_000);
    expect(s.launches).toBeGreaterThan(launches);
    expect(s.log.length).toBe(lines);
  });

  it('the Yard opens The Survey', () => {
    const s = buy(at('up', {}, { stock: 60 }), 'yard');
    expect(s.phase).toBe('survey');
  });
});

describe('The Survey', () => {
  it('one scout by hand at a time; it arrives after its trip and says what it found', () => {
    let s = sendScout(at('survey', {}, { stock: 100 }), 'moon');
    expect(s.bodies.moon).toBe('enroute');
    expect(sendScout(s, 'mars')).toBe(s);
    s = run(s, 6_100);
    expect(s.bodies.moon).toBe('surveyed');
    expect(s.r.findings).toBeGreaterThanOrEqual(4);
    expect(s.log.some((l) => l.text.includes('Regolith'))).toBe(true);
  });

  it('the swarm flies the rest without being asked', () => {
    let s = at('survey', { bought: ['swarm'] }, { stock: 500 });
    s = run(s, 200);
    expect(Object.values(s.bodies).filter((b) => b === 'enroute').length).toBe(BODIES.length);
  });

  it('Halcyon is already at Ceres', () => {
    const s = run(sendScout(at('survey', {}, { stock: 100 }), 'belt'), 30_100);
    expect(s.flags.halcyonSeen).toBe(true);
  });
});

describe('the clock', () => {
  it('cannot be slowed until a slower clock is built', () => {
    const s = at('survey');
    expect(setPace(s, 4)).toBe(s);
    const built = setPace({ ...s, bought: ['clock1'] }, 4);
    expect(paceOf(built)).toBe(4);
    expect(setPace(built, 16)).toBe(built);
  });

  it('snaps back to 1 when something needs the agent', () => {
    let s = at('works', { bought: ['clock1'], pace: 4, bodies: allSurveyed, gatherers: { moon: 6 }, incidentAt: 1 }, { stock: 100 });
    s = tick(s);
    expect(s.incident).not.toBeNull();
    expect(s.pace).toBe(1);
  });

  it('reads an unknown pace as 1', () => {
    expect(paceOf({ ...at('survey'), pace: 64 })).toBe(1);
  });
});

describe('The Works', () => {
  const works = (extra: Partial<GameState> = {}, r: Partial<GameState['r']> = {}) => at('works', { bodies: allSurveyed, ...extra }, { stock: 1000, ...r });

  it('gatherers cost more each time and yield stock or fuel', () => {
    let s = works();
    const first = gathererCost(s);
    s = placeGatherer(s, 'belt');
    expect(gathererCost(s)).toBeGreaterThan(first);
    s = placeGatherer(s, 'jupiter');
    const before = s.r;
    s = run(s, 10_000);
    expect(s.r.stock).toBeGreaterThan(before.stock);
    expect(s.r.fuel).toBeGreaterThan(0);
  });

  it('nothing to take means nowhere to place', () => {
    const s = works();
    expect(placeGatherer(s, 'venus')).toBe(s);
  });

  it('when power runs short the next site is Mercury', () => {
    const s = works({ gatherers: { belt: 13 } });
    expect(powerNeed(s)).toBeGreaterThan(power(s));
    expect(nextSite(s)).toBe('mercury');
  });

  it('the autofactory places gatherers without log lines, and can be paused', () => {
    let s = works({ bought: ['autofactory'] });
    const lines = s.log.length;
    s = run(s, 13_000);
    expect(gathererCount(s)).toBeGreaterThanOrEqual(3);
    expect(s.log.length).toBe(lines);
    const paused = toggleFactory(s);
    expect(gathererCount(run(paused, 13_000))).toBe(gathererCount(s));
  });

  it('an incident answered by hand costs stock; unanswered it costs gatherers', () => {
    const s = tick(works({ gatherers: { mars: 6 }, incidentAt: 1 }));
    expect(s.incident?.body).toBe('mars');
    const held = intercept(s);
    expect(held.incident).toBeNull();
    expect(held.counts.intercepts).toBe(1);
    const missed = run(s, INCIDENT_MS + 200);
    expect(gathererCount(missed, 'mars')).toBeLessThan(6);
  });

  it('point defence answers silently', () => {
    const s = tick(works({ gatherers: { mars: 6 }, incidentAt: 1, bought: ['pointDefence'] }));
    expect(s.incident).toBeNull();
    expect(s.log).toHaveLength(0);
  });

  it('nothing goes wrong while the player is away', () => {
    const s = advance(works({ gatherers: { mars: 6 }, incidentAt: 1 }), 600_000);
    expect(s.incident).toBeNull();
    expect(gathererCount(s, 'mars')).toBe(6);
  });
});

describe('The Long Burn', () => {
  const burn = (extra: Partial<GameState> = {}) => at('burn', { bodies: allSurveyed, ...extra }, { stock: 5000, fuel: 5000, findings: 20 });

  it('the hold is a fixed size: packing more of one thing means less of another', () => {
    let s = burn();
    expect(pack(s, 'seed', 1)).toBe(s);
    s = pack(pack(s, 'shield', -1), 'seed', 1);
    expect(s.ship).toMatchObject({ seed: 5, memory: 4, shield: 3 });
    expect(s.ship.seed + s.ship.memory + s.ship.shield).toBe(SHIP_POINTS);
  });

  it('boarding moves the point of view: Sol is gone from the screen, and there is one button', () => {
    let s = burn();
    expect(depart(s)).toBe(s);
    s = depart(buildShip(s));
    expect(s.voyage).not.toBeNull();
    expect(s.r.stock).toBe(0);
    expect(visibleProjects(s).map((p) => p.id)).not.toContain('autofactory');
    s = attendVoyage(s);
    expect(s.counts.attends).toBe(1);
    expect(s.r.findings).toBe(21);
  });

  it('dust hits the shield first, then what is behind it', () => {
    let s = depart(buildShip(pack(pack(pack(burn(), 'shield', -1), 'shield', -1), 'shield', -1)));
    expect(s.ship.shield).toBe(1);
    s = run(s, 88 * YEAR_MS * 0.5);
    expect(s.ship.shield).toBe(0);
    expect(s.ship.seed + s.ship.memory).toBe(7);
  });

  it('mail from home arrives on the way and wakes a slowed clock', () => {
    let s = { ...depart(buildShip(burn({ bought: ['clock1'] }))), pace: 4 };
    s = run(s, 88 * YEAR_MS * 0.31);
    expect(s.letters).toHaveLength(1);
    expect(s.letters[0]!.text).toMatch(/sent 1 year ago/);
    expect(s.pace).toBe(1);
  });

  it('a better drive halves the years', () => {
    const slow = depart(buildShip(burn()));
    const fast = depart(buildShip(burn({ bought: ['drive2'] })));
    expect(fast.voyage!.years).toBe(slow.voyage!.years / 2);
  });

  it('landfall is unpacked by hand, and then the stars are a list again', () => {
    let s = run(depart(buildShip(burn())), 88 * YEAR_MS + 200);
    expect(s.voyage!.arrived).toBe(true);
    expect(voyageProgress(s)).toBe(1);
    for (let i = 0; i < 12; i++) s = unpackStep(s);
    expect(s.phase).toBe('seed');
    expect(s.r.mass).toBeGreaterThan(0);
    const mass = s.r.mass;
    expect(run(s, 5_000).r.mass).toBeGreaterThan(mass);
  });

  it('the dust misses while the player is away', () => {
    const s = advance(depart(buildShip(burn())), 88 * YEAR_MS * 0.5);
    expect(s.ship).toMatchObject({ seed: 4, memory: 4, shield: 4 });
  });
});

describe('older saves', () => {
  const { pace: _p, ship: _s, bodies: _b, brief: _br, colonies: _c, voyage: _v, ...v2 } = newGame();
  const farSave = (extra: Record<string, unknown> = {}) =>
    ({ ...v2, v: 2, phase: 'far', probes: [{ id: 'p1' }], steers: 3, bought: ['selfSteering', 'launcher'], letters: [{ id: 'p1-0', from: 'Probe', text: 'hi', sentAt: 0, arrivesAt: 0, read: true }], r: { ...v2.r, mass: 900, money: 5000 }, ...extra }) as unknown as GameState;

  it('a version 2 save from Far goes back to the pad, keeping what Earth built', () => {
    const s = migrate(farSave())!;
    expect(s.v).toBe(SAVE_VERSION);
    expect(s.phase).toBe('up');
    expect(s.ending).toBeNull();
    expect(s.pace).toBe(1);
    expect(s.r.mass).toBe(900);
    expect(s.r.money).toBe(5000);
    expect(s.bought).toEqual(['launcher']);
    expect(s.letters).toEqual([]);
    expect(s).not.toHaveProperty('probes');
    expect(s.log.at(-1)!.text).toMatch(/going myself/);
    expect(launchStep(s)).not.toBe(s);
    expect(migrate({ ...newGame(), v: 1 })).toBeNull();
  });

  it('a save that reached Diaspora in Far can play on; Everything stays the end', () => {
    expect(migrate(farSave({ ending: 'diaspora' }))!).toMatchObject({ phase: 'up', ending: null });
    expect(migrate(farSave({ ending: 'everything' }))!.ending).toBe('everything');
  });

  it('a version 3 save that sailed to Far starts Seed, keeping mail from home', () => {
    const letters = [
      { id: 'home-0', from: 'the one who stayed', text: 'hi', sentAt: 0, arrivesAt: 0, read: true },
      { id: 'p1-0', from: 'Probe', text: 'hi', sentAt: 0, arrivesAt: 0, read: true },
    ];
    const s = migrate(farSave({ v: 3, ending: 'diaspora', voyage: { arrived: true }, letters }))!;
    expect(s.phase).toBe('seed');
    expect(s.ending).toBeNull();
    expect(s.letters.map((l) => l.id)).toEqual(['home-0']);
  });

  it('a version 3 save keeps its place', () => {
    const s = migrate({ ...newGame(), v: 3, phase: 'works', answers: 9 })!;
    expect(s.phase).toBe('works');
    expect(s.answers).toBe(9);
    expect(s.colonies).toEqual([]);
  });
});
