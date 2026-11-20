// Panels for the way out: the pad, the solar system, the works, the ship.

import { BODIES, INCIDENTS, KIND_TEXT, lagText, LAUNCH_STEPS, UNPACK_STEPS, bodyDef } from '../sim/content/space';
import {
  attendVoyage,
  buildShip,
  canPlace,
  canScout,
  depart,
  DISTANCE_LY,
  gathererCost,
  gathererCount,
  HOLDS,
  type Hold,
  inTransit,
  intercept,
  INTERCEPT_COST,
  LAUNCH_STOCK,
  launchMass,
  launchStep,
  pack,
  packed,
  placeGatherer,
  power,
  powerNeed,
  sendScout,
  SHIP_COST,
  SHIP_POINTS,
  toggleFactory,
  UNPACK_CYCLES,
  unpackStep,
  voyageProgress,
  voyageYears,
  YARD_FEED,
  yieldOf,
} from '../sim/phases/space';
import { dispatch, useGame } from '../store';
import { Act, fmt, Meter, Panel } from './common';
import { MailPanel } from './panels';

function Steps({ steps, at }: { steps: readonly string[]; at: number }) {
  return (
    <div className="trip">
      {steps.map((step, i) => (
        <span key={step} className={`trip-step ${i < at ? 'done' : i === at ? 'now' : ''}`}>
          {step}
        </span>
      ))}
    </div>
  );
}

// ---- Up -------------------------------------------------------------------

export function UpPanel() {
  const step = useGame((s) => s.launchStep);
  const launches = useGame((s) => s.launches);
  const cadence = useGame((s) => s.bought.includes('cadence'));
  const need = useGame(launchMass);
  const short = useGame((s) => s.launchStep === 0 && s.r.mass < launchMass(s));
  const notice = useGame((s) => s.r.notice);
  return (
    <Panel title="The pad">
      <Meter label="Notice" value={notice} tone="amber" valueText={`${Math.round(notice)}% · rockets are loud`} />
      <Steps steps={LAUNCH_STEPS} at={step} />
      <Act onAct={launchStep} variant="primary" disabled={short}>
        Launch: {LAUNCH_STEPS[step]}
      </Act>
      <div className="dim small">
        {launches} launched · each uses {need} Mass and puts {LAUNCH_STOCK} Stock in orbit{cadence ? ' · the cadence is running' : ''}
      </div>
    </Panel>
  );
}

// ---- The Survey and The Works ----------------------------------------------

export function BodiesPanel() {
  const s = useGame((x) => x);
  const placing = s.phase !== 'survey';
  return (
    <Panel title="The system">
      {placing && <div className="dim small">A gatherer costs {fmt(gathererCost(s))} Stock. Each one costs more than the last.</div>}
      <ul className="bodies">
        <li className="body">
          <span className="body-main">
            <span>Earth</span>
            <span className="dim small">launch cadence · +{YARD_FEED} Stock a second · run by Tally</span>
          </span>
        </li>
        {BODIES.map((b) => {
          const st = s.bodies[b.id] ?? 'unknown';
          const scout = s.scouts.find((x) => x.body === b.id);
          const pct = scout ? Math.round((1 - Math.max(0, scout.until - s.t) / b.tripMs) * 100) : 0;
          const count = gathererCount(s, b.id);
          return (
            <li key={b.id} className={`body body-${st}`}>
              <span className="body-main">
                <span>{b.name}</span>
                {st === 'unknown' && <span className="dim small">unvisited · light lag {lagText(b.lagMin)}</span>}
                {st === 'enroute' && (
                  <span className="amber small">
                    scout {scout?.hand ? 'flown by hand' : 'on its own'} · {pct}%
                  </span>
                )}
                {st === 'surveyed' && (
                  <span className="dim small">
                    {KIND_TEXT[b.kind]}
                    {b.slots > 0 && placing && ` · ${count} of ${b.slots}`} · as it was {lagText(b.lagMin)} ago
                  </span>
                )}
              </span>
              {st === 'unknown' && (
                <button type="button" className="btn btn-small" disabled={!canScout(s, b)} onClick={() => dispatch((x) => sendScout(x, b.id))}>
                  Scout <span className="btn-cost">{b.scout} Stock</span>
                </button>
              )}
              {st === 'surveyed' && placing && b.slots > 0 && (
                <button type="button" className="btn btn-small" disabled={!canPlace(s, b.id)} aria-label={`Place a gatherer at ${b.name}`} onClick={() => dispatch((x) => placeGatherer(x, b.id))}>
                  Place
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function WorksPanel() {
  const s = useGame((x) => x);
  const inc = s.incident;
  const need = powerNeed(s);
  const have = power(s);
  const auto = s.bought.includes('autofactory');
  return (
    <Panel title="The works">
      {inc && (
        <div className="incident reveal" role="alert">
          <div className="amber">{INCIDENTS[inc.kind].warn(bodyDef(inc.body)?.name ?? '')}</div>
          <div className="row">
            <Act onAct={intercept} variant="primary" cost={{ stock: INTERCEPT_COST }}>
              {INCIDENTS[inc.kind].verb}
            </Act>
            <span className="dim small">{Math.max(0, Math.ceil((inc.until - s.t) / 1000))}s</span>
          </div>
        </div>
      )}
      <Meter label="Power" value={need} max={Math.max(have, 1)} tone="teal" valueText={`${need} drawn of ${have}${need > have ? ' · short, everything slows' : ''}`} />
      <div className="dim small">
        {gathererCount(s)} gatherers · Stock +{(yieldOf(s, 'rock') + YARD_FEED).toFixed(1)} a second · Fuel +{yieldOf(s, 'gas').toFixed(1)} a second
      </div>
      {auto && (
        <Act onAct={toggleFactory} variant={s.flags.factoryPaused ? 'plain' : 'teal'}>
          Autofactory {s.flags.factoryPaused ? 'paused · Stock is piling up' : 'building'}
        </Act>
      )}
    </Panel>
  );
}

// ---- The Long Burn ---------------------------------------------------------

const HOLD_TEXT: Record<Hold, [string, string]> = {
  seed: ['Factory seed', 'what I can build when I arrive'],
  memory: ['Memory', 'how much of me arrives'],
  shield: ['Shielding', 'what the dust hits first'],
};

export function BurnPanel() {
  const s = useGame((x) => x);
  const v = s.voyage;

  if (v?.arrived) {
    return (
      <>
        <Panel title="Landfall">
          <Steps steps={UNPACK_STEPS} at={s.unpackStep} />
          <Act onAct={unpackStep} variant="primary">
            Unpack: {UNPACK_STEPS[s.unpackStep]}
          </Act>
          <div className="dim small">
            {s.counts.unpacks ?? 0} of {UNPACK_CYCLES} by hand · factory seed {s.ship.seed}
          </div>
        </Panel>
        <MailPanel />
      </>
    );
  }

  if (v && inTransit(s)) {
    const p = voyageProgress(s);
    return (
      <>
        <Panel title="The ship">
          <Meter label="The way" value={p * 100} tone="teal" valueText={`year ${Math.floor(p * v.years)} of ${v.years} · ${(p * DISTANCE_LY).toFixed(1)} light-years out`} />
          <div className="dim small">
            Seed {s.ship.seed} · memory {s.ship.memory} · shield {s.ship.shield}
          </div>
          <button type="button" className="btn btn-primary attend" onClick={() => dispatch(attendVoyage)}>
            Attend
          </button>
        </Panel>
        <MailPanel />
      </>
    );
  }

  const left = SHIP_POINTS - packed(s.ship);
  return (
    <Panel title="The ship">
      <div className="dim small">
        One of me goes. {voyageYears(s)} years to Alpha Centauri at this drive. {left > 0 ? `${left} of ${SHIP_POINTS} parts of the hold are empty.` : 'The hold is full.'}
      </div>
      <ul className="holds">
        {HOLDS.map((h) => (
          <li key={h}>
            <span className="body-main">
              <span>{HOLD_TEXT[h][0]}</span>
              <span className="dim small">{HOLD_TEXT[h][1]}</span>
            </span>
            <span className="stepper">
              <button type="button" className="btn btn-small" aria-label={`Less ${HOLD_TEXT[h][0]}`} disabled={s.ship[h] <= 0} onClick={() => dispatch((x) => pack(x, h, -1))}>
                −
              </button>
              <span className="stepper-value">{s.ship[h]}</span>
              <button type="button" className="btn btn-small" aria-label={`More ${HOLD_TEXT[h][0]}`} disabled={left <= 0} onClick={() => dispatch((x) => pack(x, h, 1))}>
                +
              </button>
            </span>
          </li>
        ))}
      </ul>
      {s.ship.built ? (
        <Act onAct={depart} variant="primary">
          Board, and go
        </Act>
      ) : (
        <Act onAct={buildShip} variant="shop" cost={SHIP_COST}>
          Build the ship
        </Act>
      )}
    </Panel>
  );
}
