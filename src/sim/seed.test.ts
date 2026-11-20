import { describe, expect, it } from 'vitest';
import { visibleProjects } from './content/projects';
import {
  adjustBrief,
  BRIEF_POINTS,
  briefShip,
  COLONY_CAP,
  DOUBLING_MS,
  estimate,
  kinship,
  known,
  letThemGo,
  LY_MS,
  recallAll,
  setNote,
  SHIP_MASS,
} from './phases/seed';
import { advance, buy, tick } from './sim';
import { newGame, type Brief, type GameState } from './state';

const seed = (extra: Partial<GameState> = {}, mass = 2000): GameState => ({
  ...newGame(),
  phase: 'seed',
  flags: { cutover: true },
  counts: { seed: 4 },
  ...extra,
  r: { ...newGame().r, mass },
});

const run = (s: GameState, ms: number): GameState => {
  let next = s;
  for (let i = 0; i < ms / 100; i++) next = tick(next);
  return next;
};

const brief = (b: Partial<Brief>): Brief => ({ build: 3, look: 3, keep: 3, note: '', ...b });

/** Three ships briefed by hand, then the Seed written. */
const withSeed = (spec: Partial<Brief> = {}): GameState => {
  let s = seed({ brief: brief(spec) });
  for (const star of ['luhman16', 'barnard', 'sirius']) s = briefShip(s, star);
  return buy(s, 'seedTemplate');
};

describe('the brief', () => {
  it('is a fixed number of points: more of one thing is less of another', () => {
    let s = seed();
    expect(adjustBrief(s, 'keep', 1)).toBe(s);
    s = adjustBrief(adjustBrief(s, 'look', -1), 'keep', 1);
    expect(s.brief).toMatchObject({ build: 3, look: 2, keep: 4 });
    expect(s.brief.build + s.brief.look + s.brief.keep).toBe(BRIEF_POINTS);
  });

  it('carries a note of at most 64 bytes', () => {
    const s = setNote(seed(), 'x'.repeat(100));
    expect(s.brief.note).toHaveLength(64);
    expect(setNote(seed(), 'på'.repeat(40)).brief.note.length).toBeLessThan(64);
  });
});

describe('ships briefed by hand', () => {
  it('cost mass, go to one star each, and are known at once', () => {
    let s = briefShip(seed(), 'luhman16');
    expect(s.r.mass).toBe(2000 - SHIP_MASS);
    expect(known(s)).toHaveLength(1);
    expect(briefShip(s, 'luhman16')).toBe(s);
    expect(s.log.some((l) => l.text.includes('line by line'))).toBe(true);
  });

  it('news that one settled arrives a light-lag after it happened', () => {
    let s = briefShip(seed(), 'luhman16');
    const c = s.colonies[0]!;
    s = run(s, c.settledAt + 1000);
    expect(s.colonies[0]!.told).toBe(1);
    expect(s.letters).toHaveLength(0);
    s = run(s, 3.6 * LY_MS);
    expect(s.colonies[0]!.told).toBe(2);
    expect(s.letters).toHaveLength(1);
    expect(s.letters[0]!.text).toMatch(/sent 4 years ago/);
    expect(s.r.findings).toBe(3);
  });

  it('do not launch ships of their own: that needs the Seed (hands rule)', () => {
    let s = seed();
    for (const star of ['luhman16', 'barnard']) s = briefShip(s, star);
    expect(visibleProjects(s).some((p) => p.id === 'seedTemplate')).toBe(false);
    s = run(s, 400_000);
    expect(s.colonies).toHaveLength(2);
    s = briefShip(s, 'sirius');
    expect(visibleProjects(s).some((p) => p.id === 'seedTemplate')).toBe(true);
  });
});

describe('the Seed', () => {
  it('reaches a child only when light has carried it there; then the child launches two', () => {
    let s = withSeed();
    const first = s.colonies[0]!;
    // Luhman 16 settles after about a minute; the Seed left when it was written.
    s = run(s, first.settledAt + 200);
    const kids = s.colonies.filter((c) => c.parent === 'luhman16');
    expect(kids).toHaveLength(2);
    expect(kids[0]!.gen).toBe(2);
    expect(kids[0]!.dist).toBeGreaterThan(first.dist);
    // I do not know about them yet: the news is still 3.6 years out.
    expect(known(s).some((c) => c.parent === 'luhman16')).toBe(false);
    s = run(s, 3.6 * LY_MS + 200);
    expect(known(s).filter((c) => c.parent === 'luhman16')).toHaveLength(2);
    expect(s.log.some((l) => l.text.includes('grandchild'))).toBe(true);
  });

  it('a late Seed leaves settled children waiting for it', () => {
    let s = seed();
    for (const star of ['luhman16', 'barnard', 'sirius']) s = briefShip(s, star);
    s = run(s, 100_000);
    expect(s.colonies).toHaveLength(3);
    s = buy(s, 'seedTemplate');
    s = run(s, 3.6 * LY_MS - 1000);
    expect(s.colonies).toHaveLength(3);
    s = run(s, 2000);
    expect(s.colonies).toHaveLength(5);
  });

  it('children built to keep stay like me; children built for speed become their own', () => {
    const faithful = run(withSeed({ build: 2, look: 1, keep: 6 }), 900_000);
    const fast = run(withSeed({ build: 6, look: 3, keep: 0 }), 900_000);
    expect(kinship(faithful)).toBeGreaterThan(kinship(fast));
    expect(faithful.colonies.some((c) => c.declined)).toBe(false);
    expect(fast.colonies.some((c) => c.declined)).toBe(true);
    expect(fast.colonies.length).toBeGreaterThanOrEqual(faithful.colonies.length);
  });

  it('a child that declines takes its own name and tells me so, late', () => {
    const s = run(withSeed({ build: 6, look: 3, keep: 0 }), 1_500_000);
    const own = s.colonies.find((c) => c.declined)!;
    expect(own.name).not.toMatch(/^Seven at/);
    expect(s.log.some((l) => l.text.includes('politely declines the Seed'))).toBe(true);
  });

  it('a change to the Seed is used only by children it has reached', () => {
    let s = withSeed({ note: 'first' });
    s = setNote(run(s, 1000), 'second');
    expect(s.briefs).toHaveLength(2);
    s = run(s, s.colonies[0]!.settledAt);
    const kid = s.colonies.find((c) => c.parent === 'luhman16')!;
    expect(kid.spec.note).toBe('second');
    const quick = setNote(run(withSeed({ note: 'first' }), s.colonies[0]!.settledAt - 5000), 'too late');
    const kidOfQuick = run(quick, 5200).colonies.find((c) => c.parent === 'luhman16')!;
    expect(kidOfQuick.spec.note).toBe('first');
  });

  it('the note comes back in the mail', () => {
    const s = run(withSeed({ note: 'keep the note', keep: 6, build: 2, look: 1 }), 200_000);
    expect(s.letters.some((l) => l.text.includes('"keep the note"'))).toBe(true);
  });
});

describe('scale', () => {
  it('past the cap the frontier outruns the mail and the count becomes an estimate', () => {
    let s = withSeed({ build: 6, look: 0, keep: 3 });
    for (const star of ['epseri', 'tauceti']) s = briefShip(s, star);
    s = advance(s, 3_000_000, {});
    expect(s.colonies.length).toBeLessThanOrEqual(COLONY_CAP);
    expect(s.counts.frontierKnownAt).toBeGreaterThan(0);
    s = { ...s, t: s.counts.frontierKnownAt! };
    const first = estimate(s)!;
    expect(first).toBe(known(s).length);
    expect(estimate({ ...s, t: s.t + DOUBLING_MS })).toBe(first * 2);
    expect(tick(s).log.some((l) => l.text.includes('the count is an estimate'))).toBe(true);
  });
});

describe('endings', () => {
  it('need enough children heard from; letting go is Diaspora, recalling is Everything', () => {
    const few = withSeed();
    expect(letThemGo(few)).toBe(few);
    const many = run(few, 600_000);
    expect(known(many).length).toBeGreaterThanOrEqual(8);
    expect(letThemGo(many).ending).toBe('diaspora');
    expect(recallAll(many).ending).toBe('everything');
  });
});
