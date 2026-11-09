"use client";
import { useEffect, useState } from "react";

export default function SchoolLogo({ src, alt, className, fallbackClassName }) {
  const [unavailable, setUnavailable] = useState(!src);
  useEffect(() => setUnavailable(!src), [src]);

  if (unavailable) {
    return (
      <span
        role="img"
        aria-label={`${alt} unavailable`}
        className={fallbackClassName}
      >
        DPVN
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setUnavailable(true)}
    />
  );
}
