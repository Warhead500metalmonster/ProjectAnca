// Sitenin yenilikleri: her güncellemede en üste bir tane eklenir, Topluluk → Duyurular'da "Yenilik" etiketiyle görünür.
// Site sahibinin kendi duyuruları veritabanında (announcements), bunlar kodda: ayrıca bir şey çalıştırmaya gerek yok.
// date: tam zaman (ISO, saat dahil); duyurularla birlikte en yeni en üstte sıralanır
export interface ChangelogItem { date: string; title: string; body: string }

export const CHANGELOG: ChangelogItem[] = [
  {
    date: "2026-10-30T18:43:00+04:00",
    title: "Kullanıcı bizden üstündür",
    body: "Ana sayfanın altında artık Biz kimiz ve Sıkça sorulanlar var; tüm sorular Sıkça sorulanlar sayfasında.
"
      + "Yazdıkların boşa gitmesin: yeni kayıtta inceleme, not ya da puan girdiysen, Profili düzenle'de de değişiklik yaptıysan kaydetmeden çıkarken soruyoruz.
"
      + "Teknik hata yazıları yerine anlaşılır Türkçe mesajlar, yanlış bir linke gidersen de seni yolda bırakmayan bir sayfa geliyor.",
  },
  {
    date: "2026-10-30T11:02:00+04:00",
    title: "Daha derli toplu ekranlar",
    body: "Telefonda profilindeki sayıların yazıları artık üst üste binmiyor. Kendi profilinde gizlilik notları tek satırda, \"Değiştir\" doğrudan Gizlilik ayarlarını açıyor; aynı işi yapan ikinci \"+ Ekle\" düğmesi kalktı.\n"
      + "Etkinlik sayfasında alttaki sabit Katıl düğmesi, üstteki Katıl ekrandan çıkınca beliriyor. Sosyal'deki okunmamış mesaj sayısı artık küçük bir rozet.",
  },
  {
    date: "2026-10-30T01:54:00+04:00",
    title: "Keşfet ve daha sade bir site",
    body: "Üst menüde yeni Keşfet: her oyun, film, dizi, anime ve albüm burada. Adını yaz, aynı anda her yerde aransın; sonuçlar türlerine göre raflarda gelir. Telefonda üstteki büyüteçten açılır.\n"
      + "Yeni kayıt penceresi sadeleşti: tür, isim, durum, puan ve inceleme önde; süre, tarihler, mağaza, not, etiket ve kapak \"Daha fazla ayrıntı\"nın altında. Pencere açılınca direkt yazmaya başlayabilirsin.\n"
      + "Ana sayfada aynı şeyi iki kez anlatan kutular kalktı, akışta oynama süresi artık bir kez yazıyor.",
  },
  {
    date: "2026-10-30T01:40:00+04:00",
    title: "Profili düzenle artık daha sade",
    body: "Profili düzenle sayfası dört sekmeye ayrıldı: Profil (ad, fotoğraf, bağlantılar), Görünüm (tema, kapak, arka plan, şarkı), Gizlilik (kimler ne görsün) ve Hesap (puan ölçeği, bildirimler, verilerin). Kaydet düğmesi altta hep elinin altında; hangi sekmede değişiklik yaparsan yap, tek seferde kaydedilir.",
  },
  {
    date: "2026-10-30T01:34:00+04:00",
    title: "Üstteki dönen kapakları gizle",
    body: "Profilinin üstünde dönen kapakları istemiyorsan, kendi profilinde şeridin köşesindeki \"Bu şeridi gizle\"ye bas. Üst kısım tamamen şeffaf olur, arka plan resmin oradan görünür. Geri açmak istersen: Ayarlar → Kapak görseli görünsün.",
  },
  {
    date: "2026-10-30T01:20:00+04:00",
    title: "Kapak kadrajı, rozetten etkinliğe",
    body: "Ayarlar'da kapak görselinin ve arka plan resminin kadrajını seçebilirsin: resmi tutup sürükle, yakınlaştır; hangi kısmı görünsün sen karar ver.\n"
      + "Profildeki etkinlik rozetine tıklayınca o etkinliğin sayfası açılır, en üstte o kişinin sonucu görünür: kaçıncı bitirdi, hangi sürümle, ne zaman, notu ve kazandığı rozetler.\n"
      + "Etkinliklerde film, dizi ve animede artık \"Bunu izleyeceğim\", müzikte \"Bunu dinleyeceğim\" yazıyor.",
  },
  {
    date: "2026-10-30T01:05:00+04:00",
    title: "Etkinlikler daha kolay, daha görünür",
    body: "Etkinlikler sayfasında süren ve yaklaşan etkinlikler büyük vitrinlerle en üstte. Takip ettiklerinden kimin katıldığını görürsün, \"Arkadaşını çağır\" ile linki tek dokunuşta paylaşırsın.\n"
      + "Katıldıysan etkinlik sayfasında önce kendi durumun çıkar; telefonda katılmadıysan ekranın altında Katıl düğmesi hep elinin altında.\n"
      + "Sohbete yapıştırdığın resim linkleri (Imgur, Discord, .jpg, .png…) kendiliğinden fotoğraf olarak görünür.\n"
      + "Profilindeki etkinlikler artık kapaklı kartlar; istersen Ayarlar'dan gizleyebilirsin.",
  },
  {
    date: "2026-10-30T00:55:00+04:00",
    title: "Etkinlik rozetleri, fotoğraflar ve arşiv",
    body: "Etkinlikler artık üst menüde, Topluluk'un yanında. Katılabileceğin bir etkinlik varsa yanında küçük bir ışık yanar.\n"
      + "Etkinliklere katılana yeni rozetler: Etkinlikçi (katılınca), Etkinlik ruhu (bitirince), İlk bitiren (herkesten önce bitirene), Müdavim (3 etkinliğe katılınca). Her etkinliğin bitirenlere kendi özel rozeti de olabilir; Ocarina of Time'ı bitirene Hyrule Kahramanı!\n"
      + "Etkinlik sohbetinde link ile fotoğraf paylaşabilirsin.\n"
      + "Biten etkinlikler arşivlenir: sonuçlar, ilk bitiren, kimin hangi sürümü oynadığı, notlar ve sohbet saklanır; yazmaya kapanır ama istediğin zaman dönüp bakabilirsin.",
  },
  {
    date: "2026-10-30T00:30:00+04:00",
    title: "Etkinlikler geldi: ilki Ocarina of Time!",
    body: "Artık hep birlikte oynuyoruz. İlk etkinliğimiz 5 Kasım'da başlıyor: Hep birlikte Ocarina of Time. İsteyen 1998'in orijinalini, isteyen 3DS'i, isteyen yeni Switch 2 remake'ini oynasın.\n"
      + "Etkinlik sayfasında sürümünü seçip katılırsın; istersen oyun kütüphanene de eklenir. Nerede olduğunu yazabilir, bitirince işaretleyebilirsin; kimin hangi sürümde olduğu ve kimin kaçıncı bitirdiği görünür.\n"
      + "Etkinlik sohbetinde yazışabilirsin; spoiler içeren mesajlar gizli durur, dokununca açılır.\n"
      + "Bir etkinliği bitirene \"Etkinlik ruhu\" rozeti. Katıldığın etkinlikler profilinde görünür, başladığı gün sana haber veririz. Biten etkinlikler Geçmiş etkinlikler'de saklanır.\n"
      + "Bütün etkinlikler: menüden Etkinlikler, ya da ana sayfadaki etkinlik kartı.",
  },
  {
    date: "2026-10-29T23:55:00+04:00",
    title: "Profil sayıları artık Profili düzenle'de",
    body: "Adının yanındaki büyük sayıları Profili düzenle → Profilimdeki sayılar'dan gizleyebilir, hangilerinin görüneceğini ve neyin sayılacağını seçebilirsin. Sadece animeleri ya da sadece film ve dizileri saymak için o türe basman yeter. Profilindeki sayıların yanındaki ⚙ seni doğrudan oraya götürür.\n"
      + "Renkli temalarda kapak görselini kapatınca üstte kalan renkli şerit kalktı; ad ve fotoğrafın yukarı çıkıyor.",
  },
  {
    date: "2026-10-29T22:50:00+04:00",
    title: "Profil sayıların, favori ekleme ve şeffaf tema",
    body: "Adının yanındaki büyük sayıları artık sen seçiyorsun: Ana sayfayı düzenle'den gösterip gizleyebilir, hangilerinin görüneceğini ve hangi türlerin sayılacağını (ör. animeler sayılmasın) seçebilirsin.\n"
      + "Favoriler bölümündeki \"+ Favori ekle\" ile istediğin oyunu, filmi, animeyi doğrudan favorine koy; kütüphanende olmasa da bulup ekler.\n"
      + "Yeni açılan profiller sade başlıyor: sayılar kapalı, sadece son eklenenler. Vitrinini istediğin gibi sen kurarsın.\n"
      + "Ayarlar'dan kapak görselini kapatabilirsin. Şeffaf tema artık diğer temalarla aynı düzende; arka plan resmin üstünde ayrı kutular yok.\n"
      + "İçe aktar sayfası, başka yere gidip geri dönünce hep baştan açılıyor.",
  },
  {
    date: "2026-10-29T20:10:00+04:00",
    title: "Çıkış takvimi, bildirimler ve paylaşılabilir yıl özeti",
    body: "Yeni Çıkış takvimi: planladığın oyunların ve filmlerin çıkış günü, izlediğin dizilerin ve animelerin yeni bölümleri tek sayfada. Ana sayfanda da Yaklaşanlar olarak görünür; o gün geldiğinde siteye girince sana haber veririz.\n"
      + "Ancalog'u telefonuna ya da bilgisayarına uygulama gibi kurabilirsin: Ayarlar → Uygulama ve bildirimler. Orada bildirimleri de açarsan yeni mesaj, beğeni, yorum ve çıkış günlerinde cihazına bildirim gelir; istediğin an kapatırsın.\n"
      + "Yıl özetini artık resim olarak paylaşabilirsin: özet sayfasında \"Görsel olarak paylaş\"a bas, Instagram'a, WhatsApp'a ne istersen at.",
  },
  {
    date: "2026-10-29T20:00:00+04:00",
    title: "Bölüm takibi, tekrar oynama, etiketler ve Steam otomatik güncelleme",
    body: "Dizi ve animelerde kaçıncı sezon ve bölümde olduğunu yazabilirsin; ana sayfadaki kapağın köşesindeki +1 ile bir bölüm daha izlediğini tek dokunuşla işlersin, son bölümde bitirmek isteyip istemediğin sorulur.\n"
      + "Bitirdiğin bir şeye geri mi döndün? Kaydında \"Yeniden başla\"ya bas: önceki seferin tarihi ve puanıyla saklanır, kaçıncı kez olduğu görünür.\n"
      + "Kayıtlarına kendi etiketlerini ekle: co-op, çocukluğum, yağmurlu gün… Kütüphanende etikete dokununca sadece onlar listelenir.\n"
      + "Steam'i bir kez bağla, unut: İçe aktar → Steam'de \"Her gün otomatik güncel tut\"u işaretlersen siteye girdiğinde oynama sürelerin tazelenir, yeni oynadığın oyunlar kendiliğinden eklenir. Silmiş olduğun oyunlar geri gelmez, istediğin an kapatırsın.",
  },
  {
    date: "2026-10-29T19:50:00+04:00",
    title: "Arkadaşların öneriyor",
    body: "Ana sayfanda yeni bir bölüm: takip ettiklerinin 9 ve üstü puan verdiği, senin kütüphanende henüz olmayan şeyler. Kaç arkadaşın sevmişse o kadar öne çıkar; kapağın köşesindeki + ile tek dokunuşta ekleyebilirsin.",
  },
  {
    date: "2026-10-29T19:45:00+04:00",
    title: "Linkler artık güzel görünüyor, şeffaf tema düzeldi",
    body: "Profilini, bir oyunu, bir listeyi ya da yıl özetini WhatsApp, Discord, X gibi yerlere attığında artık kocaman bir kart çıkıyor: adın, fotoğrafın, kaç kayıt yaptığın ve en sevdiğin kapaklar. Gizli profillerin kütüphanesi kartta da görünmez.\n"
      + "Şeffaf temalı profillerde üst kısım yeniden düzgün: fotoğraf, ad ve düğmeler yerinde, yazılar açık renkli arka planlarda da okunuyor.",
  },
  {
    date: "2026-10-29T19:30:00+04:00",
    title: "Temalı profiller de yeni tasarımda",
    body: "Profil teması seçmiş olanların profili eski kutulu düzende kalıyordu; artık herkes yeni tasarımda. Temanın rengi ve arka plan resmin aynen duruyor, renk artık bütün sayfayı boyuyor.",
  },
  {
    date: "2026-10-29T19:20:00+04:00",
    title: "Serializd'den içe aktarma, kaynağa göre silme",
    body: "Serializd'deki dizilerin de artık gelir: İçe aktar → Serializd'deki düğmeyi yer imlerine sürükle, Serializd profilinde bas, yapıştır. Diziler TMDB numarasıyla birebir eşleşir; izleme listen Planlandı, izlemeye devam ettiklerin İzliyorum olarak gelir.\n"
      + "Ayarlar → Kayıtlarımı sil'de artık nereden geldiğine göre seçebilirsin: sadece Steam'den gelenler, sadece Xbox'tan gelenler gibi; türle birlikte de seçebilirsin.",
  },
  {
    date: "2026-10-29T18:50:00+04:00",
    title: "Profil ana sayfan artık tamamen senin",
    body: "Ana sayfayı düzenle'de her bölüme ayrı ayrı tür seçebilirsin: Şu an devam ettikleri'nde animeler görünmesin, Özet sadece oyunları saysın gibi.\n"
      + "Aynı bölümü istediğin kadar ekleyebilirsin: bir Favoriler sadece oyunlar, bir başkası sadece animeler; ya da oyun ve anime bir arada. Sınır yok.\n"
      + "Her bölüme kendi başlığını verebilir, kopyalayabilir, sırasını değiştirebilirsin.",
  },
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
