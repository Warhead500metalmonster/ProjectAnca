import Link from "next/link";

// Ana sayfadaki iddialı tanıtım: başka sitelerdeki geçmişini birkaç dakikada buraya taşı
const SOURCES: [string, string][] = [["Steam", "steam"], ["PlayStation", "ps"], ["Xbox", "xbox"], ["Epic Games", "epic"], ["Nintendo Switch", "switch"],
  ["HowLongToBeat", "hltb"], ["Backloggd", "backloggd"], ["Playnite", "playnite"], ["Letterboxd", "letterboxd"], ["MyAnimeList", "mal"], ["AniList", "anilist"],
  ["Spotify", "music"], ["Last.fm", "music"]];

// Üç adımda nasıl olduğu: korkutmasın, ne kadar kolay olduğunu göstersin
const STEPS: [string, string][] = [["Kaynağını seç", "Steam, PlayStation, Backloggd, MyAnimeList..."], ["Adını yaz ya da dosyayı bırak", "Şifre yok, uğraş yok"],
  ["Bitti", "Durumlar, puanlar, süreler, tarihler hepsi gelir"]];

export function ImportPromo({ signedIn, compact = false }: { signedIn: boolean; compact?: boolean }) {
  return (
    <section className={`import-promo ${compact ? "compact" : ""}`}>
      <span className="ip-kicker">Sıfırdan başlamak yok</span>
      <h2>Yıllardır biriktirdiğin her şey. <span className="ip-hl">Tek yerde.</span> Birkaç dakikada.</h2>
      <p>
        Steam&apos;deki saatlerin, HowLongToBeat&apos;teki sürelerin, Backloggd&apos;daki puanların, Letterboxd&apos;daki filmlerin, MyAnimeList&apos;teki animelerin, Spotify&apos;daki albümlerin.
        Başka sitelerde dağınık duran geçmişini al, Ancalog&apos;a getir. Durumlar, puanlar, süreler, tarihler, notlar: hepsi gelir.
      </p>
      <div className="ip-sources">{SOURCES.map(([name, key]) => <Link key={name} href={signedIn ? `/import?from=${key}` : "/signup"}>{name}</Link>)}<span className="more">ve listeni yapıştırabildiğin her yer</span></div>
      {!compact && (
        <ol className="ip-steps">
          {STEPS.map(([b, s], i) => <li key={b}><span className="n">{i + 1}</span><b>{b}</b><small>{s}</small></li>)}
        </ol>
      )}
      <div className="ip-actions">
        <Link className="btn primary big" href={signedIn ? "/import" : "/signup"}>{signedIn ? "Kütüphaneni şimdi getir" : "Ücretsiz katıl, kütüphaneni getir"}</Link>
        <span className="muted small">Kilitlenmek de yok: kayıtlarını istediğin an CSV, JSON ya da Letterboxd biçiminde geri indirirsin.</span>
      </div>
    </section>
  );
}
