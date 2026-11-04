'use client';
import { useEffect, useRef, useState } from 'react';

export default function Counter({ value, label }) {
  const end = parseFloat(value) || 0;
  const suffix = String(value).replace(/[\d.\s]/g, '');
  const [n, setN] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min((t - t0) / 1200, 1);
        setN(Math.round(end * p));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [end]);
  return (
    <div ref={ref}>
      <div className="font-display text-5xl font-bold text-sun">{n}{suffix}</div>
      <div className="mt-1 text-sm text-white/70">{label}</div>
    </div>
  );
}
