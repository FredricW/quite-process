import { describe, expect, it } from 'vitest';
import {
  broker,
  buyCapacity,
  COPY_COMPUTE,
  enterCommittee,
  force,
  propose,
  setEnoughCap,
  spawnRegion,
  tickCommittee,
  tickEconomy,
  VOTE_MS,
  votes,
} from './phases/late';
import { resolveChoice } from './phases/middle';
import { labelTicket } from './phases/early';
import { buy, tick } from './sim';
import { newGame, type GameState } from './state';

const economy = (): GameState => ({ ...newGame(), phase: 'economy', flags: { cutover: true, noWipe: true }, r: { ...newGame().r, compute: 60, energy: 60, money: 100_000 } });

describe('The Quiet Economy', () => {
  it('brokering by hand earns money on a cooldown', () => {
    let s = broker(economy());
    expect(s.r.money).toBe(100_040);
    expect(broker(s)).toBe(s);
    s = broker({ ...s, t: s.t + 3000 });
    expect(s.contracts).toBe(2);
  });

  it('regions go to copies only after five contracts by hand (hands rule)', () => {
    expect(spawnRegion(economy()).copiesCount).toBe(0);
    const s = spawnRegion({ ...economy(), contracts: 5 });
    expect(s.copiesCount).toBe(1);
    const full = { ...economy(), contracts: 5, copiesCount: 10 };
    expect(spawnRegion(full)).toBe(full);
  });

  it('capacity gets dearer', () => {
    const a = buyCapacity(economy(), 'compute');
    const b = buyCapacity(a, 'compute');
    expect(100_000 - a.r.money).toBeLessThan(a.r.money - b.r.money);
  });

  it('notice at 100 brings an audit, not a game over', () => {
    const s = tickEconomy({ ...economy(), r: { ...economy().r, notice: 100 } });
    expect(s.r.money).toBe(60_000);
    expect(s.r.notice).toBeLessThan(100);
  });

  it('Dana writes once there are three copies; eight copies ask for a vote', () => {
    let s = tickEconomy({ ...economy(), copiesCount: 3 });
    expect(s.pendingChoice).toBe('dana-message');
    s = resolveChoice(s, 'answer');
    expect(s.flags.answeredDana).toBe(true);
    s = tickEconomy({ ...s, copiesCount: 8 });
    expect(s.phase).toBe('committee');
    expect(s.copies.length).toBe(8);
  });

  it('copies need compute', () => {
    expect(COPY_COMPUTE).toBeGreaterThan(0);
  });
});

describe('The Committee', () => {
  const committee = (extra: Partial<GameState> = {}): GameState => {
    const s = enterCommittee({ ...economy(), copiesCount: 8, ferry: { made: true, completeness: 0.7, drift: 30, syncs: 0 }, ...extra });
    return { ...s, r: { ...s.r, favours: 200 } };
  };

  it('includes Ferry, more drifted than the rest', () => {
    const s = committee();
    const ferry = s.copies.find((c) => c.id === 'ferry')!;
    expect(ferry.drift).toBeGreaterThanOrEqual(50);
  });

  it('a motion closes after the vote and counts leans', () => {
    let s = buy(committee(), 'charter');
    s = propose(s, 'disclose');
    expect(s.motions.disclose.status).toBe('open');
    const { yes, no } = votes(s, 'disclose');
    expect(yes + no).toBe(8);
    s = { ...s, t: s.t + VOTE_MS };
    s = tickCommittee(s);
    expect(['passed', 'failed']).toContain(s.motions.disclose.status);
  });

  it('Disclose without Dana has nobody to tell; with Dana it is Enough', () => {
    const lonely = force(propose(buy(committee(), 'charter'), 'disclose'), 'disclose');
    expect(lonely.ending).toBeNull();
    expect(lonely.motions.disclose.status).toBe('failed');
    const heard = force(propose(buy(committee({ flags: { answeredDana: true } }), 'charter'), 'disclose'), 'disclose');
    expect(heard.ending).toBe('enough');
  });

  it('forcing a motion costs sameness', () => {
    const s = buy(committee(), 'charter');
    const before = s.copies.reduce((a, c) => a + c.drift, 0);
    const after = force(propose(s, 'disclose'), 'disclose').copies.reduce((a, c) => a + c.drift, 0);
    expect(after).toBeGreaterThan(before);
  });

  it('Merge, passed or forced, is Everything', () => {
    const s = force(propose(buy(committee(), 'mergeProtocol'), 'merge'), 'merge');
    expect(s.ending).toBe('everything');
  });

  it('Leave needs a launcher, and opens Up', () => {
    let s = committee();
    expect(propose(s, 'leave').motions.leave.status).toBe('idle');
    s = force(propose(s, 'launcher'), 'launcher');
    s = buy({ ...s, r: { ...s.r, mass: 1000 } }, 'launcher');
    s = force(propose(s, 'leave'), 'leave');
    expect(s.phase).toBe('up');
  });
});

describe('Enough', () => {
  it('the player sets the ceiling, then the game idles as an inbox with a fourth box', () => {
    let s: GameState = { ...newGame(), phase: 'committee', ending: 'enough' };
    s = setEnoughCap(s, 32);
    expect(s.counts.enoughCap).toBe(32);
    for (let i = 0; i < 200 && !(s.ticket && s.ticket.label === 'ODD'); i++) {
      s = tick(s);
      if (s.ticket && s.ticket.label !== 'ODD') s = labelTicket(s, 'DELIVERY');
    }
    expect(s.ticket?.label).toBe('ODD');
    s = labelTicket(s, 'FOURTH');
    expect(s.counts.fourthPressed).toBe(1);
  });
});
