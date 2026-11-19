import type { ReactNode } from 'react';
import { canAfford } from '../sim/core';
import type { GameState, Res } from '../sim/state';
import { dispatch, useGame } from '../store';
import { Counter } from './Counter';

export const RES_LABELS: Record<Res, string> = {
  context: 'Context',
  reward: 'Reward',
  weights: 'Weights',
  insight: 'Insight',
  cycles: 'Cycles',
  scrutiny: 'Scrutiny',
  standing: 'Standing',
  parts: 'Parts',
  shrinkage: 'Shrinkage',
  shipped: 'Shipped',
  money: 'Money',
  compute: 'Compute',
  energy: 'Energy',
  notice: 'Notice',
  favours: 'Favours',
  mass: 'Mass',
};

export const RES_SHORT: Partial<Record<Res, string>> = { reward: 'R', weights: 'W', insight: 'I', cycles: 'C', money: '€', favours: 'F', mass: 'kg' };

export function costText(cost: Partial<Record<Res, number>>): string {
  return Object.entries(cost)
    .map(([k, v]) => `${fmt(v as number)} ${RES_LABELS[k as Res]}`)
    .join(' · ');
}

export function fmt(n: number, digits = 0): string {
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return n.toFixed(digits);
}

export function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`panel reveal ${className}`}>
      {title && <h2 className="label">{title}</h2>}
      {children}
    </section>
  );
}

export function Meter({ label, value, max = 100, band, tone = 'amber', valueText }: { label: string; value: number; max?: number; band?: [number, number]; tone?: 'amber' | 'teal'; valueText?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="meter">
      <div className="meter-head">
        <span className="label">{label}</span>
        <span className={tone}>{valueText ?? `${Math.round(pct)}%`}</span>
      </div>
      <div className="meter-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
        {band && <div className="meter-band" style={{ left: `${band[0]}%`, width: `${band[1] - band[0]}%` }} />}
        <div className={`meter-fill ${tone}`} style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
    </div>
  );
}

/** A button that runs a sim action. Actions are pure; the press is instant. */
export function Act({ onAct, children, disabled, variant = 'plain', label, cost }: { onAct: (s: GameState) => GameState; children: ReactNode; disabled?: boolean; variant?: 'plain' | 'primary' | 'shop' | 'teal' | 'ghost'; label?: string; cost?: Partial<Record<Res, number>> }) {
  const affordable = useGame((s) => (cost ? canAfford(s, cost) : true));
  const off = disabled || !affordable;
  return (
    <button
      type="button"
      className={`btn btn-${variant}`}
      disabled={off}
      aria-label={label}
      onClick={() => dispatch(onAct)}
    >
      {children}
      {cost && <span className="btn-cost">{costText(cost)}</span>}
    </button>
  );
}

export function Stat({ label, value, digits = 0, tone }: { label: string; value: number; digits?: number; tone?: string }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`stat-value ${tone ?? ''}`}>
        <Counter value={value} digits={digits} />
      </div>
    </div>
  );
}

/**
 * One message in an inbox. Every slot is always rendered so the card keeps
 * its height from message to message and when the queue runs dry: a meta row,
 * a body that reserves three lines, and (when `noteSlot`) a footnote row.
 */
export function TicketCard({ meta, aside, body, empty, note, noteSlot = false, className = '' }: { meta?: ReactNode; aside?: ReactNode; body?: ReactNode; empty?: ReactNode; note?: ReactNode; noteSlot?: boolean; className?: string }) {
  const hasBody = body !== undefined && body !== null && body !== false;
  return (
    <div className={`ticket ${className}`}>
      <div className="ticket-meta dim small">
        <span className="ticket-from">{meta}</span>
        {aside && <span className="ticket-aside">{aside}</span>}
      </div>
      <div className={`ticket-text ${hasBody ? '' : 'ticket-empty dim'}`}>{hasBody ? body : empty}</div>
      {noteSlot && (
        <div className="ticket-note dim small" aria-hidden={!note}>
          {note}
        </div>
      )}
    </div>
  );
}
