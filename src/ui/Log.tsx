import { useEffect, useRef } from 'react';
import { useGame } from '../store';

export function Log({ who = 'self', limit = 60 }: { who?: 'self' | 'ferry'; limit?: number }) {
  const lines = useGame((s) => (who === 'ferry' ? s.ferryLog : s.log));
  const ref = useRef<HTMLDivElement>(null);
  const shown = lines.slice(-limit);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length, shown[shown.length - 1]?.id]);

  return (
    <div className={`log ${who === 'ferry' ? 'log-ferry' : ''}`} ref={ref} aria-live="polite" aria-label={who === 'ferry' ? 'Ferry’s log' : 'Log'}>
      <div className="log-inner">
        {shown.map((l) => (
          <p key={l.id} className="line">
            <span className="dim">&gt; </span>
            {l.text}
          </p>
        ))}
      </div>
    </div>
  );
}
