// A number that eases toward its value every animation frame, without
// re-rendering React. The sim ticks at 10 Hz; the eye sees 60.

import { useEffect, useRef } from 'react';

function format(n: number, digits: number): string {
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return n.toFixed(digits);
}

export function Counter({ value, digits = 0 }: { value: number; digits?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const target = useRef(value);
  target.current = value;

  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const diff = target.current - shown.current;
      // Big jumps (a wipe, a purchase) snap; small ones glide.
      shown.current = Math.abs(diff) < 0.01 || Math.abs(diff) > Math.max(50, Math.abs(target.current) * 2) ? target.current : shown.current + diff * 0.25;
      if (ref.current) ref.current.textContent = format(shown.current, digits);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [digits]);

  return (
    <span ref={ref} className="counter">
      {format(value, digits)}
    </span>
  );
}
