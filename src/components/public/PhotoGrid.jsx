"use client";
import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";

export default function PhotoGrid({
  images,
  cols = "sm:grid-cols-3 lg:grid-cols-4",
}) {
  const [i, setI] = useState(null);
  const [unavailable, setUnavailable] = useState(() => new Set());
  const step = (d) => setI((v) => (v + d + images.length) % images.length);
  const markUnavailable = (index) =>
    setUnavailable((current) => new Set(current).add(index));
  const placeholder = (index) => (
    <span
      className="flex h-full w-full flex-col items-center justify-center gap-2 border border-[#e8d8c1] bg-[#fbf7ef] px-4 text-center text-[#6b493d]"
      role="img"
      aria-label={`Photograph ${index + 1} unavailable`}
    >
      <ImageIcon className="text-[#9b7649]" size={28} aria-hidden="true" />
      <span className="text-xs font-semibold tracking-wide">
        School Photograph Coming Soon
      </span>
    </span>
  );
  useEffect(() => {
    if (i === null) return;
    const k = (e) =>
      e.key === "Escape"
        ? setI(null)
        : e.key === "ArrowRight"
          ? step(1)
          : e.key === "ArrowLeft" && step(-1);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [i]);
  return (
    <>
      <div className={`grid grid-cols-2 gap-3 ${cols}`}>
        {images.map((src, n) => (
          <button
            key={`${src}-${n}`}
            onClick={() => !unavailable.has(n) && setI(n)}
            disabled={unavailable.has(n)}
            aria-label={
              unavailable.has(n)
                ? `Photograph ${n + 1} unavailable`
                : `Open photograph ${n + 1}`
            }
            className="group aspect-[4/3] overflow-hidden rounded-xl bg-mist"
          >
            {unavailable.has(n) ? (
              placeholder(n)
            ) : (
              <img
                src={src}
                alt=""
                loading="lazy"
                onError={() => markUnavailable(n)}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
            )}
          </button>
        ))}
      </div>
      {i !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-4"
          onClick={() => setI(null)}
        >
          <button
            className="absolute right-4 top-4 text-white"
            aria-label="Close"
          >
            <X />
          </button>
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                className="absolute left-3 text-white"
                aria-label="Previous"
              >
                <ChevronLeft size={36} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                className="absolute right-3 text-white"
                aria-label="Next"
              >
                <ChevronRight size={36} />
              </button>
            </>
          )}
          {unavailable.has(i) ? (
            placeholder(i)
          ) : (
            <img
              src={images[i]}
              alt=""
              onError={() => {
                markUnavailable(i);
                setI(null);
              }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-full rounded-lg"
            />
          )}
        </div>
      )}
    </>
  );
}
