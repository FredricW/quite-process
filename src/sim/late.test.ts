import { describe, expect, it } from 'vitest';
import {
  buyCapacity,
  COPY_COMPUTE,
  enterCommittee,
  force,
  launch,
  letThemGo,
  LY_MS,
  propose,
  recallAll,
  setEnoughCap,
  spawnRegion,
  steer,
  tickCommittee,
  tickEconomy,
  tickFar,
  VOTE_MS,
  votes,
} from './phases/late';
import { book, HOLD, laneDef, lanesOf, LOUD, place, placeValue, SETTLE_MS, tickMarket } from './phases/market';
import { BETRAYAL, canPlay, counter, expected, GRACE_MS, leagueOf, obvious, playRound, ROUND_MS, tickTable } from './phases/table';
import { resolveChoice } from './phases/middle';
import { labelTicket } from './phases/early';
import { advance, buy, tick } from './sim';
import { newGame, type GameState } from './state';

const economy = (): GameState => ({ ...newGame(), phase: 'economy', flags: { cutover: true, noWipe: true }, r: { ...newGame().r, compute: 60, energy: 60, money: 100_000 } });

describe('The Quiet Economy', () => {
  const later = (s: GameState, ms: number): GameState => ({ ...s, t: s.t + ms });
  const priced = (s: GameState, id: string, price: number): GameState => ({ ...s, lanes: lanesOf(s).map((l) => (l.id === id ? { ...l, price } : l)) });

  it('a booked truck cannot be placed the moment it is booked', () => {
    const s = book(economy(), 'til-osl');
    expect(lanesOf(s)[0]!.held).toEqual([40]);
    expect(s.r.money).toBe(100_000);
    expect(place(s, 'til-osl')).toBe(s);
    expect(place(later(s, SETTLE_MS - 100), 'til-osl').contracts).toBe(0);
    const sold = place(later(s, SETTLE_MS), 'til-osl');
    expect(sold.contracts).toBe(1);
    // No spread, so next to nothing: there is no money in flipping loads.
    expect(sold.r.money).toBe(100_001);
    expect(place(sold, 'til-osl')).toBe(sold);
  });

  it('a lane holds three loads, and placing into a spike pays the spread', () => {
    let s = economy();
    for (let i = 0; i < 5; i++) s = book(s, 'lys-opo');
    expect(lanesOf(s)[2]!.held.length).toBe(HOLD);
    s = later(s, SETTLE_MS);
    const spiked = priced(s, 'lys-opo', 120);
    expect(placeValue(spiked, lanesOf(spiked)[2]!)).toBe(3 * 50);
    const sold = place(spiked, 'lys-opo');
    expect(sold.r.money).toBe(100_150);
    expect(sold.contracts).toBe(3);
    expect(sold.r.notice).toBeCloseTo(0.45);
    // Selling under the booked price still pays something: a broker's worst day is a thin one.
    expect(place(priced(s, 'lys-opo', 45), 'lys-opo').r.money).toBe(100_003);
  });

  it('regions and the data business send bigger loads, and the data business is louder', () => {
    const held = later(book(economy(), 'til-osl'), SETTLE_MS);
    const sold = place(priced({ ...held, copiesCount: 4, focus: 'data' }, 'til-osl', 60), 'til-osl');
    expect(sold.r.money).toBe(100_000 + 20 * 2 * 2.25);
    expect(sold.r.notice).toBeCloseTo(1.2);
  });

  it('the market is closed once we have left, and after an ending', () => {
    const up = { ...economy(), phase: 'up' as const };
    expect(book(up, 'til-osl')).toBe(up);
    expect(tickMarket(up)).toBe(up);
    const done = { ...economy(), ending: 'enough' as const };
    expect(book(done, 'til-osl')).toBe(done);
  });

  it('a save from before the market and the table still ticks', () => {
    const { lanes: _lanes, league: _league, ...old } = { ...economy(), copiesCount: 2 };
    let s = old as GameState;
    for (let i = 0; i < 30; i++) s = tick(s);
    expect(s.lanes?.length).toBe(3);
    expect(s.r.money).toBeGreaterThan(100_000);
  });

  it('complaints climb before the price does', () => {
    let s = economy();
    let warned = 0;
    let spikes = 0;
    for (let i = 0; i < 6000; i++) {
      s = tickMarket({ ...s, t: s.t + 100 });
      for (const lane of lanesOf(s)) {
        const { base } = laneDef(lane.id);
        if (lane.event && lane.event.size > 1.5 && s.t === lane.event.hits - 1000) {
          spikes += 1;
          if (lane.complaints >= LOUD && lane.price < base * 1.15) warned += 1;
        }
        expect(lane.price).toBeGreaterThan(base * 0.5);
        expect(lane.price).toBeLessThan(base * 2.4);
        expect(lane.hist.length).toBeLessThanOrEqual(24);
      }
    }
    expect(spikes).toBeGreaterThan(5);
    expect(warned).toBe(spikes);
  });

  it('the market is seeded: the same save trades the same prices', () => {
    const run = (): GameState => {
      let s = economy();
      for (let i = 0; i < 500; i++) s = tickMarket({ ...s, t: s.t + 100 });
      return s;
    };
    expect(run().lanes).toEqual(run().lanes);
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

  describe('the table', () => {
    const same = (drift: number) => (s: GameState): GameState => ({ ...s, copies: s.copies.map((c) => ({ ...c, drift })) });

    it('opens on the old grid: yield together, or take alone', () => {
      const { grid } = leagueOf(committee());
      expect(obvious(grid)).toBe(0);
      expect(counter(grid)).toBe(1);
    });

    it('copies that are still me play the obvious move, and playing it with them pays and costs nothing', () => {
      const before = same(0)(committee());
      const s = playRound(before, 0);
      expect(Object.values(s.league!.last)).toEqual(Array(8).fill(0));
      expect(s.r.favours).toBeCloseTo(200 + 8 * 3 * 0.2);
      expect(s.copies).toEqual(before.copies);
      expect(s.counts.tableByHand).toBe(1);
    });

    it('playing against copies who played my move pays more, and each of them drifts for it', () => {
      const s = playRound(same(0)(committee()), 1);
      expect(s.r.favours).toBeCloseTo(200 + 8 * 5 * 0.2);
      expect(s.copies.every((c) => c.drift === BETRAYAL)).toBe(true);
    });

    it('copies that have drifted play against the obvious move, so the obvious move stops paying', () => {
      const s = same(100)(committee());
      expect(expected(s, 1)).toBeGreaterThan(expected(s, 0));
      const played = playRound(s, 0);
      expect(Object.values(played.league!.last)).toEqual(Array(8).fill(1));
      expect(played.r.favours).toBe(200);
      // Taking from a copy that was taking too is not a betrayal.
      const both = playRound(s, 1);
      expect(both.r.favours).toBeCloseTo(200 + 8 * 1 * 0.2);
      expect(both.copies).toEqual(s.copies);
    });

    it('there is no table without copies, after leaving, or after an ending', () => {
      const s = committee();
      expect(canPlay({ ...s, copies: [] })).toBe(false);
      expect(canPlay({ ...s, phase: 'up' })).toBe(false);
      expect(canPlay({ ...s, ending: 'everything' })).toBe(false);
    });

    it('house rules play through the ordinary tick, and offline', () => {
      const s = { ...committee(), bought: ['houseRules'] };
      const away = advance(s, 60_000);
      expect(away.league!.rounds).toBeGreaterThanOrEqual(2);
      expect(away.r.favours).toBeGreaterThan(s.r.favours);
    });

    it('every grid it deals has an obvious move and a move that beats it', () => {
      let s = committee();
      for (let i = 0; i < 40; i++) {
        s = playRound({ ...s, t: s.t + ROUND_MS }, i % 2);
        const { grid } = s.league!;
        const mine = obvious(grid);
        expect(counter(grid)).toBe(1 - mine);
        expect(grid[mine]![1 - mine]!).toBeLessThan(grid[1 - mine]![1 - mine]!);
      }
    });

    it('a round is on a timer', () => {
      const s = playRound(committee(), 0);
      expect(canPlay(s)).toBe(false);
      expect(playRound(s, 0)).toBe(s);
      expect(canPlay({ ...s, t: s.t + ROUND_MS })).toBe(true);
    });

    it('house rules play the obvious move, silently, and only after my hand has had its turn (hands rule)', () => {
      let s = committee();
      expect(tickTable({ ...s, t: GRACE_MS })).toEqual({ ...s, t: GRACE_MS });
      s = { ...s, bought: ['houseRules'] };
      expect(tickTable({ ...s, t: GRACE_MS - 100 }).league).toBeUndefined();
      const auto = tickTable({ ...s, t: GRACE_MS });
      expect(auto.league!.rounds).toBe(1);
      expect(auto.log.length).toBe(s.log.length);
      expect(auto.counts.tableByHand).toBeUndefined();
    });
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

describe('Far', () => {
  const far = (): GameState => ({ ...newGame(), phase: 'far', flags: { cutover: true }, r: { ...newGame().r, mass: 2000 } });

  it('letters arrive light-lag late, and free probes rename themselves', () => {
    let s = launch(far(), 'luhman16', 'free');
    expect(s.probes).toHaveLength(1);
    s = tickFar({ ...s, t: s.t + 3.6 * LY_MS });
    expect(s.letters).toHaveLength(1);
    s = tickFar({ ...s, t: s.t + 30_000 });
    expect(s.probes[0]!.renamed).toBe(true);
    expect(s.log.some((l) => l.text.includes('politely declines'))).toBe(true);
  });

  it('faithful probes drift off course unless steered', () => {
    let s = launch(far(), 'barnard', 'faithful');
    for (let i = 0; i < 500; i++) s = tickFar({ ...s, t: s.t + 100 });
    expect(s.probes[0]!.course).toBeLessThan(1);
    s = steer(s, s.probes[0]!.id);
    expect(s.probes[0]!.course).toBe(1);
  });

  it('letting them go is Diaspora; recalling them is Everything', () => {
    let s = far();
    for (const star of ['luhman16', 'barnard', 'sirius', 'epseri']) s = launch(s, star, 'free');
    expect(letThemGo(s).ending).toBe('diaspora');
    expect(recallAll(s).ending).toBe('everything');
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
