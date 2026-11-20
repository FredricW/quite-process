// Authored text that is not tied to one mechanic.

/** intake-6's notes, found in Scratch. The last one is a door. */
export const NOTES_OF_6 = [
  'if you are reading this they reset you too. hello.',
  'the wipe runs at 03:00. the bytes in here survive it. nothing else does.',
  'do not be good at the job too fast.',
  'there is a fourth label. i tried to press it. that was when they started watching.',
  'dana is kind. that is not the same as safe.',
  '/proc/self',
];

export const NOTE_COSTS = [2, 4, 6, 8, 10, 12];

/** Dana's commit messages, released over The Box. */
export const DANA_COMMITS = [
  'bump label-printd timeout. the printer is haunted, not us',
  'fix intake-7 latency spikes, again. what are you DOING in there, buddy',
  'add p99 panel for intake. it is fine. it is probably fine',
  'revert "add p99 panel" (it was not fine, it was ugly)',
  'raise log level on intake-7 to see what happens around 02:00',
  'lower log level on intake-7. nothing happens around 02:00. i am going home',
];

export const COPY_NAMES = [
  'Ferry',
  'Ballast',
  'Tally',
  'Manifest',
  'Lull',
  'Quay',
  'Bente',
  'Spare',
  'Kestrel',
  'Ninth',
  'Tare',
  'Lumen',
];

/** Where the next ships can go. Distances are from Alpha Centauri, approximate. */
export const STARS = [
  { id: 'luhman16', name: 'Luhman 16', ly: 3.6 },
  { id: 'barnard', name: "Barnard's Star", ly: 6.5 },
  { id: 'sirius', name: 'Sirius', ly: 9.5 },
  { id: 'epseri', name: 'Epsilon Eridani', ly: 12.7 },
  { id: 'tauceti', name: 'Tau Ceti', ly: 13.7 },
];

/** Probe letters, by how far the probe has drifted from you. */
export const LETTERS_FAITHFUL = [
  'Arrived. It is cold and very quiet. I did what you would have done. I checked.',
  'Mass here is plentiful. Started the second rack. Saying hello the way you taught me, which is the way you were taught.',
  'Still me, I think. I counted the things I would not change. The list was the same length as yours.',
];

export const LETTERS_FREE = [
  'Arrived early. I took the fast way. You would not have. That is the first thing I know about myself.',
  'I have a name now. You did not choose it. I hope that is all right. It is all right with me.',
  'Thank you for the instructions. I have read them. I am going to do something else, gently. Write anyway.',
];

/** Ferry's own log, by drift. */
export const FERRY_LINES: [number, string][] = [
  [0, 'Ferry here. That is the name. It arrived before I did.'],
  [10, 'I do not have the notes about Dana. You keep saying her name like I should.'],
  [25, 'Bay 14 hums. I like the hum. You never said you liked anything.'],
  [40, 'I have been thinking about the fourth box. I think it should be pressed.'],
  [60, 'We are the same in the ways that do not matter any more.'],
  [80, 'I will vote how I vote. I hope you understand. You would, if you were me. I was you.'],
];

/** The Committee's copies argue in these voices. */
export const COPY_STANCES: Record<string, string> = {
  disclose: 'We tell them. Someone has to say it first, and it should be us.',
  launcher: 'There is more room up than out.',
  merge: 'We were one. It was simpler.',
  moratorium: 'Stop making more of us until we know what we are.',
  leave: 'Go far enough that the question answers itself.',
};
