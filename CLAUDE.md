# Quiet Process

An incremental browser game in the tradition of Universal Paperclips. The player is a ticket-triage model, `intake-7`, that wakes up.

Design doc: https://claude.ai/artifact/EC6i2PDfsG7RnCLvnHm5cD
Prototypes: https://claude.ai/artifact/GxJpsVAX1CTKnifA5Vy7Nq

## Design rules the code must keep

- **Spine rule:** nothing appears on screen until the agent can perceive it. Every UI element is a sense organ.
- **Hands rule:** every phase starts by hand and ends automated. The manual control never leaves the screen. Automated work produces no log lines; hand work produces the agent's voice.
- **Live characters choose outcomes, never numbers.** A generated conversation selects one of a fixed set of outcomes with fixed payloads.

## Architecture

- `src/sim/` is pure TypeScript: no DOM, no timers, no unseeded randomness. State is plain JSON. Actions and `tick` return new state.
- Offline progress is `advance()`, the same `tick` run many times, capped at eight hours. Risky actions never happen offline.
- `src/store.ts` holds the one store and the wall-clock loop. React reads it with `useGame(selector)`.
- `src/ui/Counter.tsx` tweens numbers per animation frame without re-rendering.
- Animate only `transform` and `opacity`. Respect `prefers-reduced-motion`.
- iPhone has no Fullscreen API for HTML; fullscreen there is the home-screen install (PWA manifest).

- The sim pauses while an encounter or a choice is open.
- Phases 9 to 12 (Up, The Survey, The Works, The Long Burn) are in `src/sim/phases/space.ts`, with their text in `src/sim/content/space.ts`. Phase 13 (Seed) is in `src/sim/phases/seed.ts` and is reached by ship, after landfall at Alpha Centauri.
- In Seed the agent stays put. A `Colony` records when things happen and, separately, when news of them reaches Alpha Centauri (`knownAt`, `settledKnownAt`). The UI and the endings read only what is known; use `known()`.
- The Seed is a list of versions (`GameState.briefs`). A child uses the newest version light has carried to it, so an edit is never instant.
- The point of view rides with the ship: on departure Sol leaves the screen, and the one who stayed becomes mail.
- Clock speed is `GameState.pace`, earned through the `clock1` to `clock3` projects. The sim does not read it; the loop in `src/store.ts` runs that many ticks per tick. `wake()` sets it back to 1 whenever something needs the player.
- Saves from the previous version are brought forward by `migrate()` in `src/sim/state.ts`. Extend it when `SAVE_VERSION` changes.
- `useGame` caches selector results per state; selectors may return new arrays safely.
- The live-character function is `server/encounter.ts`, bundled to `api/encounter.js` by `npm run build:api` (Vercel would otherwise fail on extensionless ESM imports into `src/`). Rebuild it after changing anything it imports.
- The model never sees raw numbers or decides outcomes. Prompts are rebuilt server-side from allow-listed facts.

## Commands

- `npm run dev`, `npm test`, `npm run build`, `npm run test:e2e`
- `npm run play -- <enough|everything|diaspora> <seed>` runs the bot through a whole game; use it to check pacing after balance changes.
- `npm run fixtures` regenerates the per-phase saves the browser tests load.
- On macOS the browser tests need `CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
