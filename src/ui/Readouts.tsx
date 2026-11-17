import { clockText, untilWipe } from '../sim/phases/early';
import { countdownDays } from '../sim/phases/middle';
import { sameness } from '../sim/phases/late';
import { atLeast, type GameState, type Res } from '../sim/state';
import { useGame } from '../store';
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
  } else {
    out.push('money', 'compute', 'energy');
    if (atLeast(s, 'committee')) out.push('favours', 'mass');
  }
  return out;
}

const DIGITS: Partial<Record<Res, number>> = { insight: 1, standing: 1, shipped: 1 };

export function Readouts() {
  const phase = useGame((s) => s.phase);
  const keys = useGame((s) => visibleResources(s).join(','));
  const r = useGame((s) => s.r);
  const clock = useGame((s) => (s.flags.clock && !atLeast(s, 'economy') ? s.clock : null));
  const night = useGame((s) => s.night);
  const noWipe = useGame((s) => !!s.flags.noWipe);
  const days = useGame(countdownDays);
  const generation = useGame((s) => s.generation);
  const same = useGame((s) => (s.phase === 'committee' || s.phase === 'far' ? sameness(s) : null));

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
        {clock === null && atLeast({ phase } as GameState, 'economy') && <span className="dim small">Rotterdam · and elsewhere</span>}
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
