import Link from "next/link";

export const metadata = { title: "Nasıl kullanılır · Ancalog" };

// Kısa ve sade kullanım rehberi: her soruya bir iki cümle
const QA: [string, React.ReactNode][] = [
  ["Ancalog nedir?", <>Oynadığın oyunları, izlediğin film, dizi ve animeleri, dinlediğin müzikleri tek yerde tuttuğun kişisel kütüphanen. Puan verir, inceleme yazar, arkadaşlarının ne yaptığını görürsün.</>],
  ["Nasıl kayıt eklerim?", <>Üstteki <b>+ Ekle</b>&apos;ye bas, adını ara, listeden seç. Durumunu (Bitti, Oynuyorum, Planlandı…) ve istersen puanını seçip kaydet. Hepsi bu.</>],
  ["Durumlar ne demek?", <><b>Oynandı / İzlendi / Dinlendi</b>: oynadın, izledin ya da dinledin. <b>Oynuyorum / İzliyorum</b>: şu an devam ediyorsun. <b>Planlandı</b>: ileride yapacakların (backlog). <b>Ara verdim</b>: yarım bıraktın ama döneceksin. <b>Bıraktım</b>: devam etmeyeceksin.</>],
  ["Başka siteden kütüphanemi taşıyabilir miyim?", <>Evet. <Link className="grad" href="/import">İçe aktar</Link> sayfasından Steam, PlayStation, Xbox, Epic, Switch, HowLongToBeat, Playnite, Letterboxd ve Spotify&apos;dan aktarabilirsin. Zaten olanlar tekrar eklenmez.</>],
  ["Bir kaydı nasıl değiştiririm ya da silerim?", <>Kaydın kapağına bas, açılan pencerede <b>Düzenle</b>&apos;ye bas. Silme düğmesi de oradadır.</>],
  ["Favorilerimi nasıl sıralarım?", <>Profilinde Favoriler&apos;in yanındaki <b>Sırala</b>&apos;ya bas, kapakları sürükle (telefonda oklarla taşı), <b>Sırayı kaydet</b>&apos;e bas.</>],
  ["Arkadaşlarımla nasıl mesajlaşırım?", <>Birbirinizi takip edince <b>Sosyal → Mesajlar</b>&apos;da görünür. Site sahibine ise takip etmeden de yazabilirsin; soru, sorun ve şikayetlerin için oradan ulaş.</>],
  ["Forum nedir?", <><b>Sosyal → Forum</b>&apos;da herkes konu açıp oyun, film, dizi konuşabilir. Bir oyunun sayfasındaki <b>Forumda tartış</b> düğmesi o oyunun konularına götürür.</>],
  ["Spoiler nasıl gizlenir?", <>İncelemede, yorumda ya da forumda gizlemek istediğin yeri iki dik çizgi arasına yaz: <code>||Sonunda ölüyor||</code>. Okuyan tıklayınca görür.</>],
  ["Rozetler nasıl kazanılır?", <>Kayıt ekledikçe, bitirdikçe, yorum yazdıkça kendiliğinden gelir. Profilindeki <b>Rozetler</b> sekmesinde hangisine ne kadar kaldığını görürsün.</>],
  ["Profilimi nasıl özelleştiririm?", <><Link className="grad" href="/settings">Ayarlar</Link>&apos;dan fotoğraf, kapak, tema, Steam gibi arka plan resmi, şeffaf profil, profil şarkısı ve site rengini değiştirebilirsin. Profilinin Ana sayfa sekmesindeki <b>Ana sayfayı düzenle</b> ile hangi bölümlerin hangi sırayla görüneceğini seçip üste bir yazı ekleyebilirsin.</>],
  ["Verilerimi indirebilir miyim, hesabımı silebilir miyim?", <>Evet. <b>Ayarlar → Verilerimi indir</b> ile Excel / CSV, JSON ya da Letterboxd biçiminde indirirsin. Aynı yerden bütün kayıtlarını silip sıfırdan başlayabilir ya da hesabını tamamen silebilirsin.</>],
];

export default function HelpPage() {
  return (
    <div className="legal help">
      <h1>Nasıl kullanılır?</h1>
      <p className="muted">Kısa cevaplar. Burada olmayan bir şey sormak istersen <Link className="grad" href="/chat">site sahibine yaz</Link>.</p>
      {QA.map(([q, a]) => (
        <details key={q} className="help-q">
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}
