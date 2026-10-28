/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";

// Görseli site içinde büyük gösterir: oklarla / klavyeyle gezilir, Esc ya da boşluğa tıklayınca kapanır
export function Lightbox({ images, start, onClose }: { images: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const go = (d: number) => setI((x) => (x + d + images.length) % images.length);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setI((x) => (x - 1 + images.length) % images.length);
      if (e.key === "ArrowRight") setI((x) => (x + 1) % images.length);
    };
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = overflow; };
  }, [images.length, onClose]);

  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <img src={images[i]} alt="" onClick={(e) => e.stopPropagation()} />
      <button className="lb-close" aria-label="Kapat" onClick={onClose}>✕</button>
      {images.length > 1 && (
        <>
          <button className="lb-nav prev" aria-label="Önceki" onClick={(e) => { e.stopPropagation(); go(-1); }}>‹</button>
          <button className="lb-nav next" aria-label="Sonraki" onClick={(e) => { e.stopPropagation(); go(1); }}>›</button>
          <span className="lb-count">{i + 1} / {images.length}</span>
        </>
      )}
    </div>
  );
}
