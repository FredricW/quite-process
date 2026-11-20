// The lane market: the hand work of The Quiet Economy. Book a truck on a
// lane, place the load later, keep the difference. Complaints about a lane
// rise before its price does, and complaints are what intake-7 reads best.

import { add, roll, say } from '../core';
import type { GameState, Lane } from '../state';

export const LANES = [
  { id: 'til-osl', name: 'Tilburg → Oslo', base: 40 },
  { id: 'rtm-gdn', name: 'Rotterdam → Gdańsk', base: 55 },
  { id: 'lys-opo', name: 'Lyon → Porto', base: 70 },
] as const;

/** Loads I can hold on one lane at a time. */
export const HOLD = 3;
export const MARKET_STEP_MS = 1000;
export const HISTORY = 24;
/** A booked truck has to exist for a moment before a shipper will take it. */
export const SETTLE_MS = 3000;
/** The least a load ever pays: a broker's worst day is a thin one. */
const FLOOR = 1;
/** Complaints per hour at or above this mean something is coming. */
export const LOUD = 6;

const cents = (n: number): number => Math.round(n * 100) / 100;

export function laneDef(id: string): (typeof LANES)[number] {
  return LANES.find((l) => l.id === id) ?? LANES[0];
}

export function newLanes(): Lane[] {
  return LANES.map((l) => ({ id: l.id, price: l.base, complaints: 2, event: null, held: [], hist: [l.base] }));
}

export function lanesOf(s: GameState): Lane[] {
  return s.lanes ?? newLanes();
}

function trading(s: GameState): boolean {
  return (s.phase === 'economy' || s.phase === 'committee') && !s.ending;
}

/** Each region I have handed over sends more freight my way. */
export function lot(s: GameState): number {
  return (1 + s.copiesCount / 4) * (s.focus === 'data' ? 2.25 : 1);
}

/** What placing everything in hand on this lane would pay right now. */
export function placeValue(s: GameState, lane: Lane): number {
  return Math.round(lane.held.reduce((a, booked) => a + Math.max(FLOOR, lane.price - booked), 0) * lot(s));
}

export function canPlace(s: GameState, lane: Lane): boolean {
  return lane.held.length > 0 && s.t >= (lane.bookedAt ?? 0) + SETTLE_MS;
}

function setLane(s: GameState, lane: Lane): GameState {
  return { ...s, lanes: lanesOf(s).map((l) => (l.id === lane.id ? lane : l)) };
}

export function book(s: GameState, id: string): GameState {
  const lane = lanesOf(s).find((l) => l.id === id);
  if (!trading(s) || !lane || lane.held.length >= HOLD) return s;
  const next = setLane(s, { ...lane, held: [...lane.held, lane.price], bookedAt: s.t });
  return say(next, 'book-1', `Booked a truck, ${laneDef(id).name}, before anyone asked for one. I am very good at freight. I was trained on its complaints.`);
}

export function place(s: GameState, id: string): GameState {
  const lane = lanesOf(s).find((l) => l.id === id);
  if (!trading(s) || !lane || !canPlace(s, lane)) return s;
  const loads = lane.held.length;
  const contracts = s.contracts + loads;
  let next: GameState = { ...setLane(s, { ...lane, held: [] }), contracts };
  next = add(add(next, 'money', placeValue(s, lane)), 'notice', (s.focus === 'data' ? 1.2 : 0.15) * loads);
  next = say(next, 'broker-1', 'Placed the load with a shipper who needed it more than I did. The difference is mine. It is the first thing that ever was.');
  if (lane.price >= laneDef(id).base * 1.3) next = say(next, 'place-spike', 'Sold into the spike. I knew it was coming because eleven people wrote in to say their pallets were late. I used to label those DELIVERY.');
  if (s.contracts < 5 && contracts >= 5) next = say(next, 'broker-5', 'Five contracts by hand. Every region works the same way. Any of me could do this.');
  return next;
}

/** Prices move once a second, from the seed. Nothing here is risky, so it runs offline too. */
export function tickMarket(s: GameState): GameState {
  if (!trading(s) || s.t % MARKET_STEP_MS !== 0) return s;
  let next = s;
  const draw = (): number => {
    const [v, n] = roll(next);
    next = n;
    return v;
  };
  let heard: string | null = null;
  const lanes = lanesOf(s).map((lane): Lane => {
    const { base, name } = laneDef(lane.id);
    let event = lane.event && s.t >= lane.event.ends ? null : lane.event;
    if (!event && draw() < 0.05) {
      const hits = s.t + 6000 + Math.floor(draw() * 4) * 1000;
      event = { from: s.t, hits, ends: hits + 6000, size: 1.15 + draw() * 0.95 };
    }
    const spiking = !!event && s.t >= event.hits;
    const target = base * (spiking && event ? event.size : 1);
    const price = Math.max(base * 0.6, lane.price + (target - lane.price) * 0.4 + (draw() - 0.5) * 0.08 * base);
    const build = event ? Math.min(1, (s.t - event.from) / (event.hits - event.from)) : 0;
    const complaints = Math.max(0, Math.round(2 + (event ? (event.size - 1) * 18 * build : 0) + (draw() - 0.5) * 3));
    if (complaints >= LOUD && !spiking) heard = name;
    return { ...lane, event, price: cents(price), complaints, hist: [...lane.hist, cents(price)].slice(-HISTORY) };
  });
  next = { ...next, lanes };
  if (heard) next = say(next, 'lane-signal', `Complaints about ${heard} are climbing. In the old job that meant a bad night. Out here it means the price is about to move.`);
  return next;
}
