// Sitenin yenilikleri: her güncellemede en üste bir tane eklenir, Topluluk → Duyurular'da "Yenilik" etiketiyle görünür.
// Site sahibinin kendi duyuruları veritabanında (announcements), bunlar kodda: ayrıca bir şey çalıştırmaya gerek yok.
export interface ChangelogItem { date: string; title: string; body: string }

export const CHANGELOG: ChangelogItem[] = [
  {
    date: "2026-10-30",
    title: "Duyurular ana sayfada, daha geniş kayıt penceresi",
    body: "En yeni duyuru artık ana sayfanın üstünde ince bir satır olarak görünüyor.
"
      + "Bilgisayarda yeni kayıt penceresi ve Ayarlar daha geniş, daha az kaydırma.
"
      + "İstatistiklerdeki tür adlarının önünde çıkan gereksiz işaret düzeltildi.",
  },
  {
    date: "2026-10-29",
    title: "Yeni görünüm, puan dağılımı ve duyurular",
    body: "Bilgisayarda site baştan elden geçti: ince üst bar, ortada geniş arama, daha büyük kapaklar.\n"
      + "Profilde adının yanında büyük sayaçlar var: kaç kayıt, bu yıl kaç şey bitirdin, kaç planın var.\n"
      + "Favorilerin artık büyük kapaklarla, yan yana beş tane.\n"
      + "Oyun sayfalarında kenardan kenara geniş görsel ve oyuncuların puan dağılımı.\n"
      + "Bir şey bitirince ya da 100., 500. kaydına ulaşınca küçük bir kutlama seni bekliyor.\n"
      + "Ve bu sayfa: yenilikleri ve duyuruları artık buradan takip edebilirsin.",
  },
  {
    date: "2026-10-29",
    title: "MyAnimeList ve AniList'ten içe aktarma",
    body: "Anime listeni MyAnimeList dosyasından ya da AniList kullanıcı adınla birkaç saniyede getirebilirsin.\n"
      + "Profilinde istediğin türleri (ör. oyunları) başkalarından gizleyebilir, profil fotoğrafını kırpabilirsin.\n"
      + "Listeler artık \"liste dışı\" da olabilir: hiçbir yerde görünmez, sadece linkini verdiğin kişiler açar.",
  },
  {
    date: "2026-10-28",
    title: "Uyum sıralaması ve Ancalog sıralaması",
    body: "Topluluk sayfasında sitenin en uyumlu ikililerini ve sana en uyumlu üyeleri görebilirsin, genel ya da türe göre.\n"
      + "Ancalog sıralaması sayfasında üyelerin en sevdiği ve en sevmediği oyunlar, filmler, diziler var.",
  },
  {
    date: "2026-10-28",
    title: "Backloggd'dan içe aktarma",
    body: "Backloggd'daki bütün oyunların tek tıkla gelir: oynadıkların, oynadığın, backlog ve istek listen, puanlarınla birlikte.",
  },
];
