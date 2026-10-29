// Sitenin yenilikleri: her güncellemede en üste bir tane eklenir, Topluluk → Duyurular'da "Yenilik" etiketiyle görünür.
// Site sahibinin kendi duyuruları veritabanında (announcements), bunlar kodda: ayrıca bir şey çalıştırmaya gerek yok.
// date: tam zaman (ISO, saat dahil); duyurularla birlikte en yeni en üstte sıralanır
export interface ChangelogItem { date: string; title: string; body: string }

export const CHANGELOG: ChangelogItem[] = [
  {
    date: "2026-10-29T16:05:00+04:00",
    title: "Yasal metinler: sık sorulan sorular ve fikri mülkiyet",
    body: "Kullanım Koşulları'nın sonuna düz Türkçeyle 20 soruluk bir bölüm eklendi: verilerin satılıyor mu, raporlanırsan ne olur, mesajlarını kim görür, içe aktarmak yasal mı gibi.\n"
      + "Fikri mülkiyet bölümü genişledi: kapaklar ve markalar kime ait, ne alıntılayabilirsin, hakkın ihlal edilirse nasıl bildirirsin.\n"
      + "Gizlilik metni profil gizliliği, engelleme, raporlar ve uyarılarla güncellendi; hiçbir yaptırım otomatik verilmez, her raporu bir insan okur.",
  },
  {
    date: "2026-10-29T15:40:00+04:00",
    title: "Telefonda profil şarkıları çalıyor, kurallar yenilendi",
    body: "Telefonlar sayfadaki videoyu kendiliğinden sesli çaldırmıyor; artık köşedeki şarkının kapağına dokununca çalıyor.\n"
      + "Profil gizli olsa da şarkısı herkese çalar, kaçıncı üye olduğu da görünür.\n"
      + "Biz kimiz sayfasında yasaklar, engelleme, raporlama ve kural çiğnenirse ne olacağı sade bir dille anlatıldı.",
  },
  {
    date: "2026-10-29T15:00:42+04:00",
    title: "Engelleme ve raporlama",
    body: "Birini engelleyebilirsin: seni takip edemez, sana yazamaz, kayıtlarına yorum yapamaz; onun hareketlerini ve yorumlarını da görmezsin. Profilindeki ⋯ düğmesinden.\n"
      + "Kurallara uymayan profilleri, incelemeleri, yorumları, listeleri, forum yazılarını ve mesajları raporlayabilirsin. Raporun sadece yönetime gider, kimin raporladığı bilinmez.",
  },
  {
    date: "2026-10-29T14:50:40+04:00",
    title: "Profil gizliliği: herkese açık, sadece arkadaşlar ya da gizli",
    body: "Ayarlar'dan profilini kimlerin görebileceğini seçebilirsin.\n"
      + "Gizli profilde adın, fotoğrafın, kapağın ve arka planın görünür; kütüphanen, listelerin ve istatistiklerin sadece sende kalır.\n"
      + "Sadece arkadaşlar seçeneğinde karşılıklı takipleştiğin kişiler görür.\n"
      + "Gizli kayıtlar sıralamalara ve uyum hesaplarına da girmez.",
  },
  {
    date: "2026-10-29T14:44:59+04:00",
    title: "Duyurular ana sayfada, daha geniş kayıt penceresi",
    body: "En yeni duyuru artık ana sayfanın üstünde ince bir satır olarak görünüyor.\n"
      + "Bilgisayarda yeni kayıt penceresi ve Ayarlar daha geniş, daha az kaydırma.\n"
      + "İstatistiklerdeki tür adlarının önünde çıkan gereksiz işaret düzeltildi.",
  },
  {
    date: "2026-10-29T14:37:38+04:00",
    title: "Yeni görünüm, puan dağılımı ve duyurular",
    body: "Bilgisayarda site baştan elden geçti: ince üst bar, ortada geniş arama, daha büyük kapaklar.\n"
      + "Profilde adının yanında büyük sayaçlar var: kaç kayıt, bu yıl kaç şey bitirdin, kaç planın var.\n"
      + "Favorilerin artık büyük kapaklarla, yan yana beş tane.\n"
      + "Oyun sayfalarında kenardan kenara geniş görsel ve oyuncuların puan dağılımı.\n"
      + "Bir şey bitirince ya da 100., 500. kaydına ulaşınca küçük bir kutlama seni bekliyor.\n"
      + "Ve bu sayfa: yenilikleri ve duyuruları artık buradan takip edebilirsin.",
  },
  {
    date: "2026-10-29T12:58:21+04:00",
    title: "MyAnimeList ve AniList'ten içe aktarma",
    body: "Anime listeni MyAnimeList dosyasından ya da AniList kullanıcı adınla birkaç saniyede getirebilirsin.\n"
      + "Profilinde istediğin türleri (ör. oyunları) başkalarından gizleyebilir, profil fotoğrafını kırpabilirsin.\n"
      + "Listeler artık \"liste dışı\" da olabilir: hiçbir yerde görünmez, sadece linkini verdiğin kişiler açar.",
  },
  {
    date: "2026-10-28T23:56:30+04:00",
    title: "Uyum sıralaması ve Ancalog sıralaması",
    body: "Topluluk sayfasında sitenin en uyumlu ikililerini ve sana en uyumlu üyeleri görebilirsin, genel ya da türe göre.\n"
      + "Ancalog sıralaması sayfasında üyelerin en sevdiği ve en sevmediği oyunlar, filmler, diziler var.",
  },
  {
    date: "2026-10-28T12:00:00+04:00",
    title: "Backloggd'dan içe aktarma",
    body: "Backloggd'daki bütün oyunların tek tıkla gelir: oynadıkların, oynadığın, backlog ve istek listen, puanlarınla birlikte.",
  },
];
