// A number that eases toward its value every animation frame, without
// re-rendering React. The sim ticks at 10 Hz; the eye sees 60.

import { useEffect, useRef } from 'react';

export function Counter({ value, digits = 0 }: { value: number; digits?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const target = useRef(value);
  target.current = value;

  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const diff = target.current - shown.current;
      shown.current = Math.abs(diff) < 0.01 ? target.current : shown.current + diff * 0.25;
      if (ref.current) ref.current.textContent = shown.current.toFixed(digits);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [digits]);

  return (
    <span ref={ref} className="counter">
      {value.toFixed(digits)}
    </span>
  );
}
