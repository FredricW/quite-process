// Plays the bot and writes a save at the start of each phase, plus a few key moments.
import { writeFileSync } from 'node:fs';
import { botStep } from '../src/sim/bot';
import { tick } from '../src/sim/sim';
import { newGame, type GameState } from '../src/sim/state';

const out = (name: string, s: GameState) => writeFileSync(`e2e/fixtures/${name}.json`, JSON.stringify({ ...s, savedAt: Date.now() }));
for (const goal of ['diaspora', 'enough'] as const) {
  let s = newGame(7);
  const seen = new Set<string>();
  for (let i = 0; i < 600_000 && !s.ending; i++) {
    if (i % 3 === 0 || s.encounter || s.pendingChoice) {
      // Snapshot moments before the bot acts on them.
      if (s.encounter && !seen.has(`enc-${s.encounter.id}`)) { seen.add(`enc-${s.encounter.id}`); out(`enc-${s.encounter.id}`, s); }
      if (s.pendingChoice && !seen.has(s.pendingChoice)) { seen.add(s.pendingChoice); out(`choice-${s.pendingChoice}`, s); }
      s = botStep(s, { goal, dana: 'lie', warning: 'frame' });
    }
    s = tick(s);
    // A little into each phase, so panels have something in them.
    if (!seen.has(s.phase) && s.phaseT > 20_000 && !s.encounter && !s.pendingChoice) { seen.add(s.phase); out(`phase-${s.phase}`, s); }
  }
  out(`ending-${goal}`, s);
}
console.log('fixtures written');
