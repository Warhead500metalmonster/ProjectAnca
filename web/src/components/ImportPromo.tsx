import Link from "next/link";

// Ana sayfadaki iddialı tanıtım: başka sitelerdeki geçmişini birkaç dakikada buraya taşı
const SOURCES: [string, string][] = [["Steam", "steam"], ["PlayStation", "ps"], ["Xbox", "xbox"], ["Epic Games", "epic"], ["Nintendo Switch", "switch"],
  ["HowLongToBeat", "hltb"], ["Backloggd", "backloggd"], ["Playnite", "playnite"], ["Letterboxd", "letterboxd"], ["Spotify", "music"], ["Last.fm", "music"]];

export function ImportPromo({ signedIn, compact = false }: { signedIn: boolean; compact?: boolean }) {
  return (
    <section className={`import-promo ${compact ? "compact" : ""}`}>
      <span className="ip-kicker">Sıfırdan başlamak yok</span>
      <h2>Yıllardır biriktirdiğin her şey. <span className="ip-hl">Tek yerde.</span> Birkaç dakikada.</h2>
      <p>
        Steam&apos;deki saatlerin, HowLongToBeat&apos;teki sürelerin, Backloggd&apos;daki puanların, Letterboxd&apos;daki filmlerin, Spotify&apos;daki albümlerin.
        Başka sitelerde dağınık duran geçmişini al, Ancalog&apos;a getir. Durumlar, puanlar, süreler, tarihler, notlar: hepsi gelir.
      </p>
      <div className="ip-sources">{SOURCES.map(([name, key]) => <Link key={name} href={signedIn ? `/import?from=${key}` : "/signup"}>{name}</Link>)}<span className="more">ve listeni yapıştırabildiğin her yer</span></div>
      <div className="ip-actions">
        <Link className="btn primary big" href={signedIn ? "/import" : "/signup"}>{signedIn ? "Kütüphaneni şimdi getir" : "Ücretsiz katıl, kütüphaneni getir"}</Link>
        <span className="muted small">Kilitlenmek de yok: kayıtlarını istediğin an CSV, JSON ya da Letterboxd biçiminde geri indirirsin.</span>
      </div>
    </section>
  );
}
