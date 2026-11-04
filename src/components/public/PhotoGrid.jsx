'use client';
import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function PhotoGrid({ images, cols = 'sm:grid-cols-3 lg:grid-cols-4' }) {
  const [i, setI] = useState(null);
  const step = (d) => setI((v) => (v + d + images.length) % images.length);
  useEffect(() => {
    if (i === null) return;
    const k = (e) => (e.key === 'Escape' ? setI(null) : e.key === 'ArrowRight' ? step(1) : e.key === 'ArrowLeft' && step(-1));
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [i]);
  return (
    <>
      <div className={`grid grid-cols-2 gap-3 ${cols}`}>
        {images.map((src, n) => (
          <button key={src} onClick={() => setI(n)} className="group aspect-[4/3] overflow-hidden rounded-xl bg-mist">
            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          </button>
        ))}
      </div>
      {i !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-4" onClick={() => setI(null)}>
          <button className="absolute right-4 top-4 text-white" aria-label="Close"><X /></button>
          {images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); step(-1); }} className="absolute left-3 text-white" aria-label="Previous"><ChevronLeft size={36} /></button>
              <button onClick={(e) => { e.stopPropagation(); step(1); }} className="absolute right-3 text-white" aria-label="Next"><ChevronRight size={36} /></button>
            </>
          )}
          <img src={images[i]} alt="" onClick={(e) => e.stopPropagation()} className="max-h-[85vh] max-w-full rounded-lg" />
        </div>
      )}
    </>
  );
}
