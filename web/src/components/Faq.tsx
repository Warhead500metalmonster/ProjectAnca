import Link from "next/link";

// Sıkça sorulan sorular: ana sayfada ilk altısı, /help'te hepsi. En çok merak edilenler en üstte.
const QA: [string, React.ReactNode][] = [
  ["Ancalog ücretsiz mi?", <>Evet, tamamen. Reklam yok, &quot;premium&quot; yok, verilerini satmıyoruz. Burası kâr amacı gütmeyen bir hobi projesi.</>],
  ["Nasıl kayıt eklerim?", <>Üstteki <b>+ Ekle</b>&apos;ye bas (telefonda alttaki +), adını yaz, listeden seç. Durumunu ve istersen puanını seçip kaydet. Hepsi bu; gerisi isteğe bağlı.</>],
  ["Başka siteden kütüphanemi taşıyabilir miyim?", <>Evet. <Link className="grad" href="/import">Kütüphaneni getir</Link> sayfasından Steam, PlayStation, Xbox, Epic, Switch, HowLongToBeat, Backloggd, Playnite, Letterboxd, Serializd, MyAnimeList, AniList, Spotify ve Last.fm&apos;den getirebilirsin. Zaten olanlar tekrar eklenmez.</>],
  ["Kayıtlarımı kimler görür?", <>Sen ne dersen o. <Link className="grad" href="/settings#gizlilik">Ayarlar → Gizlilik</Link>&apos;ten profilini herkese, sadece arkadaşlarına ya da sadece kendine açabilir, istediğin türü (mesela müzikleri) gizleyebilirsin.</>],
  ["Verilerimi indirebilir miyim, hesabımı silebilir miyim?", <>Her zaman, soru sorulmadan. <Link className="grad" href="/settings#hesap">Ayarlar → Hesap</Link>&apos;tan Excel / CSV, JSON ya da Letterboxd biçiminde indirirsin. Aynı yerden kayıtlarını silip sıfırdan başlayabilir ya da hesabını tamamen silebilirsin.</>],
  ["Bir sorun buldum ya da bir fikrim var, kime yazayım?", <><Link className="grad" href="/chat/arno4436">Site sahibine yaz</Link>; takipleşmeniz gerekmez. Sitedeki pek çok özellik kullanıcıların isteğiyle eklendi, seninki de eklenebilir.</>],
  ["Durumlar ne demek?", <><b>Oynandı / İzlendi / Dinlendi</b>: oynadın, izledin ya da dinledin. <b>Oynuyorum / İzliyorum</b>: şu an devam ediyorsun. <b>Planlandı</b>: ileride yapacakların (backlog). <b>Ara verdim</b>: yarım bıraktın ama döneceksin. <b>Bıraktım</b>: devam etmeyeceksin.</>],
  ["Bir kaydı nasıl değiştiririm ya da silerim?", <>Kaydın kapağına bas, açılan pencerede <b>Düzenle</b>&apos;ye bas. Silme düğmesi de oradadır.</>],
  ["Keşfet nedir?", <>Her oyunu, filmi, diziyi, animeyi ve albümü tek kutudan aradığın yer. <Link className="grad" href="/search">Keşfet</Link>&apos;te adını yaz, sonuçlar türlerine göre gelsin; birine tıkla, sayfasını gör, kütüphanene ekle.</>],
  ["Etkinlikler nedir?", <>Aynı oyunu, filmi ya da diziyi hep birlikte oynayıp izlediğimiz dönemler. <Link className="grad" href="/events">Etkinlikler</Link>&apos;den birine gir, sürümünü seçip katıl, herkes kendi hızında ilerlesin. Bitirene özel rozet var; acele yok.</>],
  ["Favorilerimi nasıl sıralarım?", <>Profilinde Favoriler&apos;in yanındaki <b>Sırala</b>&apos;ya bas, kapakları sürükle (telefonda oklarla taşı), <b>Sırayı kaydet</b>&apos;e bas.</>],
  ["Arkadaşlarımla nasıl mesajlaşırım?", <>Birbirinizi takip edince <b>Sosyal → Mesajlar</b>&apos;da görünür.</>],
  ["Forum nedir?", <><b>Sosyal → Forum</b>&apos;da herkes konu açıp oyun, film, dizi konuşabilir. Bir oyunun sayfasındaki <b>Forumda tartış</b> düğmesi o oyunun konularına götürür.</>],
  ["Spoiler nasıl gizlenir?", <>İncelemede, yorumda ya da forumda gizlemek istediğin yeri iki dik çizgi arasına yaz: <code>||Sonunda ölüyor||</code>. Okuyan tıklayınca görür.</>],
  ["Rozetler nasıl kazanılır?", <>Kayıt ekledikçe, bitirdikçe, yorum yazdıkça kendiliğinden gelir. Profilindeki <b>Rozetler</b> sekmesinde hangisine ne kadar kaldığını görürsün.</>],
  ["Profilimi nasıl özelleştiririm?", <><Link className="grad" href="/settings#gorunum">Ayarlar → Görünüm</Link>&apos;den tema, kapak, arka plan resmi, profil şarkısı ve site rengini değiştirebilirsin. Profilinin Ana sayfa sekmesindeki <b>Ana sayfayı düzenle</b> ile hangi bölümlerin hangi sırayla görüneceğini seçersin.</>],
  ["Biri beni rahatsız ederse ne yapabilirim?", <>Profilindeki <b>⋯</b> düğmesinden engelle ya da raporla. Kimseye haber gitmez, kimin raporladığını kimse bilmez; her raporu bir insan okur. Ayrıntılar <Link className="grad" href="/about">Biz kimiz</Link> sayfasında.</>],
];

export function Faq({ limit }: { limit?: number }) {
  return (
    <>
      {QA.slice(0, limit).map(([q, a]) => (
        <details key={q} className="help-q">
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </>
  );
}

// Ana sayfanın en altı: biz kimiz ve en çok sorulanlar. signedIn: misafire "bize yaz" yerine katılma düğmesi
export function HomeInfo({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="section home-info" id="sss">
      <div className="home-about">
        <h2>Biz kimiz?</h2>
        <p className="home-motto">Kullanıcı bizden üstündür.</p>
        <p>Küçük bir ekibiz: <Link className="grad" href="/u/arno4436">Anıl</Link> ve arkadaşı <Link className="grad" href="/u/wulfa">Wulfa</Link>. Ancalog&apos;u hobi olarak, önce kendimiz kullanmak için yaptık.</p>
        <ul>
          <li>Reklam yok, ücret yok, verilerin satılmıyor.</li>
          <li>Kayıtların senin: istediğin gün indirir, gidersin.</li>
          <li>Önerilerini okuyoruz; çoğu özellik öyle geldi.</li>
        </ul>
        <div className="home-about-actions">
          <Link className="btn" href="/about">Hikâyemiz</Link>
          {signedIn ? <Link className="btn ghost" href="/chat/arno4436">Bize yaz</Link> : <Link className="btn primary" href="/signup">Ücretsiz katıl</Link>}
        </div>
      </div>
      <div className="home-faq">
        <div className="section-head"><h2>Sıkça sorulanlar</h2><Link href="/help">Tüm sorular →</Link></div>
        <Faq limit={6} />
      </div>
    </section>
  );
}
