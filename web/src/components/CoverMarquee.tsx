/* eslint-disable @next/next/no-img-element */
// Tam genişlikte, iki sıra halinde zıt yönlerde kayan kapaklar
export function CoverMarquee({ covers }: { covers: string[] }) {
  // Kapak azsa tekrarlayarak şeridi doldur
  const fill = (list: string[]) => (list.length ? Array.from({ length: Math.max(list.length, 12) }, (_, i) => list[i % list.length]) : []);
  const rows = [fill(covers.filter((_, i) => i % 2 === 0)), fill(covers.filter((_, i) => i % 2 === 1))];
  return (
    <div className="marquee" aria-hidden>
      {rows.map((row, r) => (
        <div className={`mq-row ${r ? "rev" : ""}`} key={r}>
          {[...row, ...row].map((c, i) => <img key={i} src={c} alt="" decoding="async" loading={i < 10 ? "eager" : "lazy"} onError={(e) => e.currentTarget.remove()} />)}
        </div>
      ))}
    </div>
  );
}
