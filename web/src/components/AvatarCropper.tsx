/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef } from "react";
import type { AvatarCrop } from "@/lib/types";

// Profil fotoğrafının hangi kısmının görüneceğini seçmek: resmi tutup kaydır, kaydırıcıyla yakınlaştır.
// Resmin kendisi değişmez; seçilen odak ve yakınlık profilde saklanır, her yerde aynı kırpılmış görünür.
export function AvatarCropper({ url, crop, onChange }: { url: string; crop: AvatarCrop; onChange: (c: AvatarCrop) => void }) {
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  function down(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, cx: crop.x, cy: crop.y };
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    // Resmi sağa çekmek sol tarafı göstermek demek: odak ters yöne kayar; yakınken daha hassas
    const k = 100 / e.currentTarget.clientWidth / crop.z;
    onChange({ ...crop, x: clamp(d.cx - (e.clientX - d.x) * k), y: clamp(d.cy - (e.clientY - d.y) * k) });
  }

  return (
    <div className="cropper">
      <div className="cropper-box" onPointerDown={down} onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}
        title="Görünmesini istediğin yere sürükle">
        <img src={url} alt="" draggable={false}
          style={{ objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.z})`, transformOrigin: `${crop.x}% ${crop.y}%` }} />
      </div>
      <div className="cropper-tools">
        <span className="muted small">Resmi tutup sürükle, aşağıdan yakınlaştır.</span>
        <label className="muted small">Yakınlaştır
          <input type="range" min={1} max={3} step={0.05} value={crop.z} onChange={(e) => onChange({ ...crop, z: Number(e.target.value) })} />
        </label>
        <button type="button" className="link" onClick={() => onChange({ x: 50, y: 50, z: 1 })}>Sıfırla</button>
      </div>
    </div>
  );
}
