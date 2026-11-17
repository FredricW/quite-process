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
- `useGame` caches selector results per state; selectors may return new arrays safely.
- The live-character function is `server/encounter.ts`, bundled to `api/encounter.js` by `npm run build:api` (Vercel would otherwise fail on extensionless ESM imports into `src/`). Rebuild it after changing anything it imports.
- The model never sees raw numbers or decides outcomes. Prompts are rebuilt server-side from allow-listed facts.

## Commands

- `npm run dev`, `npm test`, `npm run build`, `npm run test:e2e`
- `npm run play -- <enough|everything|diaspora> <seed>` runs the bot through a whole game; use it to check pacing after balance changes.
- `npm run fixtures` regenerates the per-phase saves the browser tests load.
