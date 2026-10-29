"use client";

import type { EntryType } from "@/lib/types";
import { TYPES, TYPE_KEYS } from "@/lib/constants";
import { COUNT_ITEMS } from "@/lib/profileLayout";

export interface Counts { show: boolean; items: string[]; types: EntryType[] }

// Profilin üstündeki büyük sayılar: göster/gizle, hangileri, hangi türler sayılsın
// Tür seçimi: "Hepsi" seçiliyken bir türe basınca sadece o seçilir (ör. sadece animeler); sonra diğerleri eklenip çıkarılır
export function CountsPicker({ value, onChange }: { value: Counts; onChange: (c: Counts) => void }) {
  const toggleIn = <T,>(arr: T[], x: T) => (arr.includes(x) ? arr.filter((y) => y !== x) : [...arr, x]);
  function pickType(k: EntryType) {
    const next = value.types.length ? toggleIn(value.types, k) : [k];
    onChange({ ...value, types: next.length && next.length < TYPE_KEYS.length ? next : [] });
  }
  return (
    <div className="home-counts">
      <label className="check"><input type="checkbox" checked={value.show} onChange={(e) => onChange({ ...value, show: e.target.checked })} /> Adımın yanında büyük sayılar görünsün (kayıt, bu yıl bitti, takipçi…)</label>
      {value.show && (
        <>
          <div className="chips">
            <span className="muted small">Hangileri:</span>
            {COUNT_ITEMS.map(([k, name]) => (
              <button type="button" key={k} className={`chip ${value.items.includes(k) ? "active" : ""}`}
                onClick={() => onChange({ ...value, items: toggleIn(value.items, k) })}>{name}</button>
            ))}
          </div>
          <div className="chips">
            <span className="muted small">Neler sayılsın:</span>
            <button type="button" className={`chip ${!value.types.length ? "active" : ""}`} onClick={() => onChange({ ...value, types: [] })}>Hepsi</button>
            {TYPE_KEYS.map((k) => (
              <button type="button" key={k} className={`chip ${value.types.includes(k) ? "active" : ""}`} onClick={() => pickType(k)}>{TYPES[k].plural}</button>
            ))}
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            {value.types.length ? `Sadece ${value.types.map((t) => TYPES[t].plural.toLocaleLowerCase("tr")).join(", ")} sayılıyor.` : "Bütün türler sayılıyor. Sadece birini saymak için ona bas."}
          </p>
        </>
      )}
    </div>
  );
}

// Kaydederken: hiçbiri seçili değilse hepsi
export const cleanCounts = (c: Counts) => ({
  show: c.show,
  items: c.items.length ? c.items : COUNT_ITEMS.map(([k]) => k),
  types: c.types.length < TYPE_KEYS.length ? c.types : [],
});
