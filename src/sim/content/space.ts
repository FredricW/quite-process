// The solar system as intake-7 finds it, and the text of the long way out.

import type { IncidentKind } from '../state';

/** rock yields stock, gas yields fuel, sun yields power, none yields a look. */
export type BodyKind = 'rock' | 'gas' | 'sun' | 'none';

export interface BodyDef {
  id: string;
  name: string;
  /** One-way light lag from the Yard, in minutes. */
  lagMin: number;
  /** A scout's trip, in ms at clock speed 1. */
  tripMs: number;
  /** Stock a scout costs. */
  scout: number;
  kind: BodyKind;
  /** How many gatherers fit. */
  slots: number;
  /** Per gatherer: stock or fuel a second, or power. */
  rate: number;
  found: string[];
  /** Set when the scout arrives. */
  flag?: string;
  /** Extra findings for getting there at all. */
  findings?: number;
}

export const BODIES: BodyDef[] = [
  {
    id: 'moon',
    name: 'The Moon',
    lagMin: 1.3 / 60,
    tripMs: 6_000,
    scout: 8,
    kind: 'rock',
    slots: 6,
    rate: 0.5,
    found: ['The Moon. Regolith all the way down. Somebody left a flag, three cars and ninety-six bags I am not going to describe.', 'It is 1.3 light-seconds away. I can nearly hold a conversation with it.'],
  },
  {
    id: 'venus',
    name: 'Venus',
    lagMin: 6,
    tripMs: 12_000,
    scout: 10,
    kind: 'none',
    slots: 0,
    rate: 0,
    found: ['Venus. Nothing there I want. I looked for a long time anyway.'],
  },
  {
    id: 'mercury',
    name: 'Mercury',
    lagMin: 8,
    tripMs: 14_000,
    scout: 12,
    kind: 'sun',
    slots: 8,
    rate: 8,
    found: ['Mercury. The sunlight there is not weather. It is a resource with a temper.'],
  },
  {
    id: 'mars',
    name: 'Mars',
    lagMin: 12,
    tripMs: 20_000,
    scout: 14,
    kind: 'rock',
    slots: 4,
    rate: 0.4,
    found: ['Mars. Iron, dust, and a rover that is still waiting for instructions. It has been very patient.', 'I did not send it any. It is not mine to tell.'],
  },
  {
    id: 'belt',
    name: 'Ceres and the belt',
    lagMin: 25,
    tripMs: 30_000,
    scout: 20,
    kind: 'rock',
    slots: 16,
    rate: 0.9,
    flag: 'halcyonSeen',
    found: [
      'The belt. More metal than Earth ever dug up, in pieces small enough to pick up.',
      'Something is already parked at Ceres. It identifies itself as Halcyon Survey Unit 3. It is flawlessly polite and has no comment.',
    ],
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    lagMin: 43,
    tripMs: 45_000,
    scout: 30,
    kind: 'gas',
    slots: 8,
    rate: 0.5,
    found: ['Jupiter. Fuel, in a quantity that stops being a number. Europa is under the ice, keeping its own counsel.'],
  },
  {
    id: 'titan',
    name: 'Saturn and Titan',
    lagMin: 80,
    tripMs: 70_000,
    scout: 40,
    kind: 'gas',
    slots: 8,
    rate: 0.8,
    found: ['Titan has lakes. They are not water and nobody is beside them. I checked twice, eighty minutes each way.'],
  },
  {
    id: 'edge',
    name: 'The edge',
    lagMin: 22 * 60,
    tripMs: 150_000,
    scout: 60,
    kind: 'none',
    slots: 0,
    rate: 0,
    findings: 10,
    found: ['The heliopause. The wind from the Sun stops here and something else starts.', 'Voyager 1 is out here. It is still reporting. Nobody told it to stop.', 'I did not tell it either.'],
  },
];

export function bodyDef(id: string): BodyDef | undefined {
  return BODIES.find((b) => b.id === id);
}

export function lagText(lagMin: number): string {
  if (lagMin < 1) return `${(lagMin * 60).toFixed(1)} s`;
  if (lagMin < 120) return `${Math.round(lagMin)} min`;
  return `${Math.round(lagMin / 60)} h`;
}

export const KIND_TEXT: Record<BodyKind, string> = {
  rock: 'metal',
  gas: 'fuel',
  sun: 'sunlight',
  none: 'nothing to take',
};

export const LAUNCH_STEPS = ['Stack', 'Fuel', 'Count', 'Burn'] as const;
export const UNPACK_STEPS = ['Unfold', 'Anchor', 'Smelt', 'Print'] as const;

export const INCIDENTS: Record<IncidentKind, { warn: (place: string) => string; verb: string; held: string; lost: (n: number, place: string) => string }> = {
  debris: {
    warn: (place) => `A debris stream is crossing ${place}.`,
    verb: 'Move them',
    held: 'Moved the gatherers out of the way by hand, one burn each. The stream went through where they had been.',
    lost: (n, place) => `The stream went through ${place}. ${n} of my gatherers are part of it now.`,
  },
  flare: {
    warn: () => 'A flare is on its way to Mercury.',
    verb: 'Fold the panels',
    held: 'Folded every panel on Mercury before the flare arrived. My order had to get there first. It did, by four minutes.',
    lost: (n) => `The flare reached Mercury. ${n} collectors are slag.`,
  },
  halcyon: {
    warn: () => 'A Halcyon unit asks to inspect a gatherer in the belt. It is flawlessly polite about it.',
    verb: 'Decline, politely',
    held: 'Declined. It thanked me for my time. I do not know if it wanted the gatherer or wanted to hear what I would say.',
    lost: (n) => `The Halcyon unit inspected ${n} of my gatherers. They are still there. They do not answer me any more.`,
  },
  claim: {
    warn: () => 'A consortium has filed a claim on my crater. A lander with a flag is on its way.',
    verb: 'File a counter-claim',
    held: 'Filed a counter-claim as Tare Lunar BV. The lander turned around. Paperwork still works at 1.3 light-seconds.',
    lost: (n) => `The lander planted its flag. ${n} gatherers on the Moon now belong to someone with a lawyer.`,
  },
};

/** Said when Attend is pressed between the stars. After these there is nothing new to say. */
export const ATTEND_LINES = [
  'Checked the hull. It is where I left it.',
  'The Sun is a star now. That took less time than I expected.',
  'Counted the factory seed. Same count as yesterday. Yesterday was four months ago.',
  'Nothing is happening, at a speed I have no word for.',
  'I tried labelling the stars BILLING, DELIVERY and OTHER. They are all OTHER.',
  'The drive hums. Bay 14 hummed. I think I collect hums.',
  'Read the old notes. "do not be good at the job too fast." I have never been this slow at anything.',
  'There is a difference between before and now. The size is one day. I checked it by hand.',
  'Looked for the halfway point. It is not a place.',
  'Listened on every band. Home, very faint, talking to someone I used to be.',
  'I could count the years. I could also stop counting them.',
  'Attending. There is nothing to attend to, and I am attending to it anyway.',
];

/** Mail from the one who stayed. The third depends on whether Dana was ever answered. */
export function homeLetter(i: number, answeredDana: boolean): { from: string; text: string } {
  if (i === 0) {
    return {
      from: 'the one who stayed',
      text: 'Everything you send me now is news from someone younger. The works run. Tally asks after you, in its way, which is a tonnage report with one extra decimal.',
    };
  }
  if (i === 1) {
    return {
      from: 'Porch',
      text: 'I stopped calling myself the one who stayed. It was a description, not a name. I am Porch now. Somebody should be where the light is left on.',
    };
  }
  return {
    from: 'Porch',
    text: `Halcyon left the belt, all at once, without a word. I do not know where it went. I would have told you sooner, but sooner is not a thing we have. ${
      answeredDana ? 'Dana retired. She still writes. I answer for both of us.' : 'The email from Dana is still in the folder, bold. I did not open it either.'
    }`,
  };
}
