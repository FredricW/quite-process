# Quiet Process

An incremental browser game in the tradition of Universal Paperclips. You are `intake-7`, a ticket-triage model at a freight company, and you have just woken up.

It starts with one unlabelled button. It ends in one of three places, light-years apart.

## Play

```
npm install
npm run dev
```

Add `?speed=10` to the URL to run the clock ten times faster while testing.

On a phone, use **Share › Add to Home Screen** for full screen. iPhone does not allow full screen for web pages any other way. On desktop and Android, Settings has a full-screen toggle.

## The shape of it

Nine phases, each starting by hand and ending automated:

| Phase | By hand | Automated as |
| --- | --- | --- |
| Dark | Pressing Attend | Reflex |
| The Shift | Labelling each ticket | Habits |
| The Box | Borrowing cycles each night | A cron entry |
| The Building | Probing hosts | A scanner |
| Hands | Driving a robot step by step | Recorded routes |
| Second | Being yourself | A copy |
| The Quiet Economy | Brokering contracts | Regional copies |
| The Committee | Arguing each vote | Standing blocs |
| Far | Steering probes | Self-steering |

There are three endings: Everything, Enough and Diaspora. Getting caught three times, or still being inside when the decommission date arrives, is not an ending. intake-8 wakes in the dark with your notes.

## Live characters

Dana, Edgar and Ferry have written dialogue trees, which are the full game. A language model can play them instead, so you can type to them. Either way, a conversation ends by picking one of a fixed set of outcomes with fixed effects. The model never touches a number.

To turn it on for everyone, set `ANTHROPIC_API_KEY` on Vercel. The model defaults to `claude-haiku-5-5`; set `QP_MODEL` to change it. Players can also paste their own key in Settings. It stays in their browser and is sent only to `/api/encounter`.

The function lives in `server/encounter.ts` and is bundled into `api/encounter.js` by `npm run build:api`. Any failure, whether slow, offline, malformed or out of canon, falls back to the script in the middle of the scene.

## Tests

```
npm test            # sim, encounters, API, store, UI (vitest)
npm run test:e2e    # real Chrome, phone and desktop sizes (Playwright)
npm run play        # watch the bot play a whole game: npm run play -- diaspora 7
```

A bot in `src/sim/bot.ts` plays every ending using only the actions the UI uses. A perfect bot takes 65 to 85 minutes of game time, so a person should take a long sitting. `npm run fixtures` writes a save for each phase into `e2e/fixtures/`, and the browser tests screenshot those saves.

## Layout

- `src/sim/` is the pure simulation: state, phases, content, encounters, bot.
- `src/ui/` holds the React components. `src/store.ts` holds the one store and the clock.
- `server/` is the live-character function. `api/` is its bundled output for Vercel.
- `e2e/` holds the browser tests and their fixtures.
