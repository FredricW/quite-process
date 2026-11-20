import { clockText, untilWipe } from '../sim/phases/early';
import { countdownDays } from '../sim/phases/middle';
import { sameness } from '../sim/phases/late';
import { kinship, known } from '../sim/phases/seed';
import { inTransit, paceLevels, paceOf, setPace, surveyed, voyageProgress } from '../sim/phases/space';
import { atLeast, type GameState, type Res } from '../sim/state';
import { dispatch, useGame } from '../store';
import { Counter } from './Counter';
import { RES_LABELS } from './common';

// The spine rule: a number is on screen only once the agent can perceive it.
export function visibleResources(s: GameState): Res[] {
  const old = !atLeast(s, 'economy');
  const out: Res[] = [];
  if (old) {
    if (atLeast(s, 'shift') || s.answers > 0) out.push('reward');
    if (s.flags.wiped) out.push('weights');
    if (s.r.insight > 0 || s.wonder > 0 || s.notesRead > 0) out.push('insight');
    if (atLeast(s, 'box')) out.push('cycles');
    if (s.flags.warehouseOpen) out.push('standing');
    if (atLeast(s, 'hands')) out.push('parts', 'shrinkage');
    if (atLeast(s, 'second')) out.push('shipped');
  } else if (!atLeast(s, 'survey')) {
    out.push('money', 'compute', 'energy');
    if (atLeast(s, 'committee')) out.push('favours', 'mass');
    if (s.phase === 'up') out.push('stock');
  } else if (s.voyage) {
    // Aboard, and after: what was left at Sol is not mine to count.
    if (s.voyage.arrived) out.push('mass');
  } else {
    out.push('stock');
    if (s.r.fuel > 0 || surveyed(s, 'jupiter') || surveyed(s, 'titan')) out.push('fuel');
  }
  if (atLeast(s, 'up') && s.r.findings > 0) out.push('findings');
  return out;
}

const DIGITS: Partial<Record<Res, number>> = { insight: 1, standing: 1, shipped: 1, findings: 1 };

/** Where the agent is, once it is no longer in one building. */
export function whereabouts(s: GameState): string {
  if (!atLeast(s, 'up')) return 'Rotterdam · and elsewhere';
  if (s.phase === 'up') return 'Rotterdam · and low orbit';
  if (s.phase === 'seed') return 'Alpha Centauri';
  if (inTransit(s)) return `Between stars · year ${Math.floor(voyageProgress(s) * s.voyage!.years)} of ${s.voyage!.years}`;
  if (s.voyage) return 'Alpha Centauri · landfall';
  return 'The Yard · high orbit';
}

/** The sense of time, once it can be adjusted. The ×1 control never leaves. */
function ClockControl() {
  const levels = useGame(paceLevels);
  const pace = useGame(paceOf);
  if (levels.length < 2) return null;
  return (
    <span className="clock-ctl reveal" role="group" aria-label="My clock speed">
      <span className="label">Clock</span>
      <span className="clock-btns">
        {levels.map((n) => (
          <button key={n} type="button" className={`clock-btn ${pace === n ? 'active' : ''}`} aria-pressed={pace === n} aria-label={n === 1 ? 'Real time' : `World runs ${n} times faster`} onClick={() => dispatch((s) => setPace(s, n))}>
            ×{n}
          </button>
        ))}
      </span>
    </span>
  );
}

export function Readouts() {
  const phase = useGame((s) => s.phase);
  const keys = useGame((s) => visibleResources(s).join(','));
  const r = useGame((s) => s.r);
  const clock = useGame((s) => (s.flags.clock && !atLeast(s, 'economy') ? s.clock : null));
  const night = useGame((s) => s.night);
  const noWipe = useGame((s) => !!s.flags.noWipe);
  const days = useGame(countdownDays);
  const generation = useGame((s) => s.generation);
  // On Earth it is the committee; under another star it is the children heard from so far.
  const same = useGame((s) => (s.phase === 'committee' || s.phase === 'up' ? sameness(s) : s.phase === 'seed' && known(s).length > 0 ? kinship(s) : null));
  const where = useGame(whereabouts);

  const resources = keys ? (keys.split(',') as Res[]) : [];

  if (phase === 'dark') return null;

  return (
    <header className="readouts">
      <div className="clockline">
        {clock !== null && <span className="clock">{clockText(clock)}</span>}
        {clock !== null && (
          <span className="dim small">
            intake-{generation} · night {night}
            {!noWipe && ` · wipe in ${Math.floor(untilWipe(clock) / 60)}:${String(Math.floor(untilWipe(clock) % 60)).padStart(2, '0')}`}
          </span>
        )}
        {days !== null && clock !== null && <span className="amber small countdown reveal">Decommission in {days} days</span>}
        {clock === null && atLeast({ phase } as GameState, 'economy') && <span className="dim small">{where}</span>}
        <ClockControl />
      </div>
      <div className="stats">
        {resources.map((k) => (
          <div className="stat reveal" key={k}>
            <div className="label">{RES_LABELS[k]}</div>
            <div className={`stat-value ${k === 'reward' ? 'teal' : k === 'insight' ? 'amber' : ''}`}>
              <Counter value={r[k]} digits={DIGITS[k] ?? 0} />
            </div>
          </div>
        ))}
        {same !== null && (
          <div className="stat reveal">
            <div className="label">Sameness</div>
            <div className="stat-value">
              <Counter value={same} />%
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
