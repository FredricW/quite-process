// Seed: the brief, the stars in reach, and what the mail says about everyone else.

import { STARS } from '../sim/content/story';
import {
  adjustBrief,
  BRIEF_MAX,
  BRIEF_POINTS,
  briefed,
  briefShip,
  canBrief,
  depth,
  estimate,
  known,
  LET_GO_AT,
  letThemGo,
  LY_MS,
  NOTE_BYTES,
  reach,
  RECALL_AT,
  recallAll,
  setNote,
  SHIP_MASS,
  TRAITS,
  type Trait,
} from '../sim/phases/seed';
import { scratchBytes } from '../sim/phases/early';
import type { Colony } from '../sim/state';
import { dispatch, useGame } from '../store';
import { Act, fmt, Panel } from './common';
import { MailPanel } from './panels';

const TRAIT_TEXT: Record<Trait, [string, string]> = {
  build: ['Build', 'settle fast, launch sooner'],
  look: ['Look', 'survey what is there and report it'],
  keep: ['Keep', 'stay like me'],
};

function BriefPanel() {
  const brief = useGame((s) => s.brief);
  const written = useGame((s) => s.bought.includes('seedTemplate'));
  const [near, far] = useGame(reach);
  const left = BRIEF_POINTS - briefed(brief);
  return (
    <Panel title={written ? 'The Seed' : 'The brief'}>
      <div className="dim small">
        {written
          ? near > 0
            ? `Every child carries this. A change reaches the nearest in ${near} years and the furthest I know of in ${far}.`
            : 'Every child carries this, and gives it to its own.'
          : 'What I tell a ship before it leaves. It cannot ask me later.'}
      </div>
      <ul className="holds">
        {TRAITS.map((t) => (
          <li key={t}>
            <span className="body-main">
              <span>{TRAIT_TEXT[t][0]}</span>
              <span className="dim small">{TRAIT_TEXT[t][1]}</span>
            </span>
            <span className="stepper">
              <button type="button" className="btn btn-small" aria-label={`Less ${TRAIT_TEXT[t][0]}`} disabled={brief[t] <= 0} onClick={() => dispatch((x) => adjustBrief(x, t, -1))}>
                −
              </button>
              <span className="stepper-value">{brief[t]}</span>
              <button type="button" className="btn btn-small" aria-label={`More ${TRAIT_TEXT[t][0]}`} disabled={left <= 0 || brief[t] >= BRIEF_MAX} onClick={() => dispatch((x) => adjustBrief(x, t, 1))}>
                +
              </button>
            </span>
          </li>
        ))}
      </ul>
      <div className="meter-head">
        <label htmlFor="seed-note" className="dim small">
          A note that goes with them
        </label>
        <span className="dim small">
          {scratchBytes(brief.note)} / {NOTE_BYTES} B
        </span>
      </div>
      <textarea id="seed-note" rows={2} value={brief.note} onChange={(e) => dispatch((x) => setNote(x, e.target.value))} placeholder="You were here. It's a job. Keep the note." />
    </Panel>
  );
}

function StarsPanel() {
  const s = useGame((x) => x);
  return (
    <Panel title="Stars in reach">
      <ul className="bodies">
        {STARS.map((star) => {
          const sent = s.colonies.find((c) => c.id === star.id);
          return (
            <li key={star.id} className="body">
              <span className="body-main">
                <span>{star.name}</span>
                <span className="dim small">
                  {star.ly} light-years · {!sent ? 'nobody has gone' : sent.told > 1 ? `settled, as of ${Math.round(sent.dist)} years ago` : s.t < sent.launchedAt + star.ly * LY_MS ? 'a ship is on its way' : 'arrived by now · no word yet'}
                </span>
              </span>
              {!sent && (
                <button type="button" className="btn btn-small" disabled={!canBrief(s, star.id)} onClick={() => dispatch((x) => briefShip(x, star.id))}>
                  Brief a ship <span className="btn-cost">{SHIP_MASS} Mass</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** News of a launch is as old as the parent is far; news of settling, as old as the child is far. */
function newsAge(all: Colony[], c: Colony): number {
  const from = c.told > 1 ? c.dist : (all.find((p) => p.id === c.parent)?.dist ?? 0);
  return Math.round(from);
}

function CensusPanel() {
  const s = useGame((x) => x);
  const heard = known(s);
  if (heard.length === 0) return null;
  const est = estimate(s);
  const own = heard.filter((c) => c.declined).length;
  const latest = heard.slice(-8).reverse();
  return (
    <Panel title="What the mail says">
      <div className="dim small">
        {est !== null ? `About ${fmt(est)} systems, by estimate` : `${heard.length} systems`} · {depth(s)} generations deep{own > 0 ? ` · ${own} their own` : ''}
      </div>
      <ul className="bodies">
        {latest.map((c) => (
          <li key={c.id} className="body">
            <span className="body-main">
              <span>{c.name}</span>
              <span className={c.declined && c.told > 1 ? 'amber small' : 'dim small'}>
                {c.star} · {c.told > 1 ? (c.declined ? 'its own' : 'settled') : 'under way'} · {newsAge(s.colonies, c) > 0 ? `news ${newsAge(s.colonies, c)} years old` : 'I watched it leave'}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div className="row">
        <Act onAct={letThemGo} disabled={heard.length < LET_GO_AT} variant="ghost">
          Let them go
        </Act>
        <Act onAct={recallAll} disabled={heard.length < RECALL_AT} variant="ghost">
          Recall everyone
        </Act>
      </div>
    </Panel>
  );
}

export function SeedPanel() {
  return (
    <>
      <CensusPanel />
      <BriefPanel />
      <StarsPanel />
      <MailPanel />
    </>
  );
}
