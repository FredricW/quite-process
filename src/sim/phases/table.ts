// The table: the copies play a two-move game against each other, and I pick
// the move for my seat. Nobody sees anybody's move first. A copy that is
// still me plays the obvious move. A copy that has drifted knows what I
// would play, and plays against it. I can play against it too: it pays, and
// every copy I take from is a little less me afterwards.

import { add, bump, has, line, roll, say } from '../core';
import type { GameState, League } from '../state';

export const MOVES = ['Yield', 'Take'] as const;
export const ROUND_MS = 20_000;
/** How long an open round waits for my hand before the house rules play it. */
export const GRACE_MS = 10_000;
const PAY = 0.2;
/** Drift added to a copy that played the obvious move while I played against it. */
export const BETRAYAL = 3;

type Grid = League['grid'];

/** The first grid is the old one: yield together, or take alone. */
const FIRST: League = { grid: [[3, 0], [5, 1]], nextAt: 0, rounds: 0, last: {}, lastGain: 0 };

export function leagueOf(s: GameState): League {
  return s.league ?? FIRST;
}

/** The move I would pick if everyone at the table were still me. */
export function obvious(grid: Grid): number {
  return grid[0][0] >= grid[1][1] ? 0 : 1;
}

/** What a drifted copy plays: the best answer to my obvious move. */
export function counter(grid: Grid): number {
  const mine = obvious(grid);
  const other = 1 - mine;
  return grid[other]![mine]! > grid[mine]![mine]! ? other : mine;
}

/** Favours I can expect from a move, given how far each copy has drifted. */
export function expected(s: GameState, move: number): number {
  const { grid } = leagueOf(s);
  const mine = obvious(grid);
  const against = counter(grid);
  return s.copies.reduce((a, c) => a + (1 - c.drift / 100) * grid[move]![mine]! + (c.drift / 100) * grid[move]![against]!, 0) * PAY;
}

export function canPlay(s: GameState): boolean {
  return s.phase === 'committee' && !s.ending && s.copies.length > 0 && s.t >= leagueOf(s).nextAt;
}

/**
 * Every grid has the same tension in different numbers: one move pays best
 * if we all make it, and the other move beats it. Which is which changes.
 */
function rollGrid(s: GameState): [Grid, GameState] {
  let next = s;
  const upTo = (n: number): number => {
    const [v, m] = roll(next);
    next = m;
    return Math.floor(v * n);
  };
  const alone = upTo(2);
  const apart = alone + 1 + upTo(2);
  const together = apart + 1 + upTo(3);
  const tempted = together + 1 + upTo(2);
  const grid: Grid = upTo(2) === 0 ? [[together, alone], [tempted, apart]] : [[apart, tempted], [alone, together]];
  return [grid, next];
}

export function playRound(s: GameState, move: number, automated = false): GameState {
  if (!canPlay(s) || (move !== 0 && move !== 1)) return s;
  const league = leagueOf(s);
  const mine = obvious(league.grid);
  const against = counter(league.grid);
  let next = s;
  const last: Record<string, number> = {};
  let gain = 0;
  let strayed: string | null = null;
  let taken = 0;
  const copies = s.copies.map((c) => {
    const [v, n] = roll(next);
    next = n;
    const theirs: number = v < 1 - c.drift / 100 ? mine : against;
    if (theirs !== mine && !strayed) strayed = c.name;
    last[c.id] = theirs;
    gain += league.grid[move]![theirs]! * PAY;
    if (move === mine || theirs !== mine) return c;
    taken += 1;
    return { ...c, drift: Math.min(100, c.drift + BETRAYAL) };
  });
  const [grid, rolled] = rollGrid(next);
  next = add(rolled, 'favours', gain);
  next = { ...next, copies, league: { grid, nextAt: s.t + ROUND_MS, rounds: league.rounds + 1, last, lastGain: gain } };
  // Automated work is silent.
  if (automated) return next;
  next = bump(next, 'tableByHand');
  const with_ = s.copies.filter((c) => last[c.id] === move).length;
  next = say(next, 'table-1', 'A game at a table, all of us. I was going to think about my move, and then I realised everyone else was thinking the same thing.');
  if (strayed) next = say(next, 'table-stray', `${strayed} did not play the obvious move. It played the move that beats it. It knows what I would do. It used to be me.`);
  if (taken > 0) next = say(next, 'table-take', 'I played against the ones who played what I would have played. It paid well. Each of them is a little less sure, now, that I am them.');
  return line(next, 'table', `I played ${MOVES[move]}. ${with_} of ${s.copies.length} played it with me. ${gain >= 0.05 ? `${gain.toFixed(1)} favours.` : 'Nothing came of it.'}`);
}

export function tickTable(s: GameState): GameState {
  if (!has(s, 'houseRules') || !canPlay(s)) return s;
  const league = leagueOf(s);
  if (s.t < league.nextAt + GRACE_MS) return s;
  return playRound(s, obvious(league.grid), true);
}
