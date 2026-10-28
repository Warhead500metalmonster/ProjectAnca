# Ancalog

Oyun, film, dizi, müzik ve anime günlüğü + topluluk. Oynadığın, izlediğin, dinlediğin her şeyi logla, puanla, incele, listeler yap, arkadaşlarını takip et.

**Site:** https://ancalog.vercel.app

## Özellikler

**Kütüphane**
- Oyun, film, dizi, müzik ve anime tek yerde
- Arama: oyunlar [RAWG](https://rawg.io), film ve diziler [TMDB](https://www.themoviedb.org), animeler [AniList](https://anilist.co), müzik Apple Music + Deezer; aramada olmayan şarkı YouTube / Spotify / SoundCloud linkiyle ya da elle eklenir ve herkesin kullandığı ortak kataloğa bir kez yazılır
- Kayıtta platform, mağaza, emülatör, başlama / bitirme tarihi, kaç günde bitti, süre ve ilerleme (saat-dakika-saniye), not, inceleme
- 5 ya da 10 üzerinden puan: herkes puanları kendi seçtiği ölçekte görür
- **Steam'den içe aktarma** (oyunlar ve oynama süreleri) ve **Letterboxd'dan içe aktarma** (CSV)
- Birden çok filtre bir arada, Backlog şeridi, "Ne yapsam?" rastgele seçici

**Topluluk**
- İncelemelere beğeni ve yorum, `||spoiler||` gizleme
- Takip, akış, karşılıklı takipleşenlerle mesajlaşma
- Bildirimler; arkadaşın senin planladığın bir şeyi bitirince haber
- Arkadaşla **uyum yüzdesi**: ortak sevilenler, öneriler, ayrışılanlar
- Açık / gizli listeler, listedekilerin kaçını bitirdiğin yüzdesiyle

**Profil**
- Steam gibi profil temaları, sayfayı kaplayan arka plan resmi / GIF / video, profil şarkısı (ziyaretçi sesini ayarlar)
- Kendine özel site rengi, favoriler (her kategoriden 10), sosyal bağlantılar
- Rozetler: site sahibi, yönetici, öncü ve hedefe ulaşınca kendiliğinden gelenler (Eleştirmen, Maratoncu, Sinefil…)
- Tüm zamanlar istatistikleri, yıllık hedef, **yıl özeti** sayfası

**Yönetim**
- Yönetim paneli: istatistikler, site duyurusu, yönetici atama, rozet verme, hesap silme, yasaklı kelimeler, yorum denetimi, ortak katalog ve sayfa düzeltmeleri

**Diğer**
- Telefonda ana ekrana eklenebilir (uygulama gibi açılır)
- Kullanım Koşulları ve Gizlilik / KVKK Aydınlatma Metni (`/terms`, `/privacy`)
- Ayarlar'dan veri indirme ve hesap silme

## Yapı

| Klasör | Ne işe yarar |
|---|---|
| `web/` | Site (Next.js). Vercel bu klasörü yayınlar. |
| `supabase/schema.sql` | İlk veritabanı şeması |
| `supabase/migrations/` | Sonraki veritabanı değişiklikleri (002–009), sırayla çalıştırılır |
| `index.html` | Eski GitHub Pages adresini yeni siteye yönlendirir |

Veriler [Supabase](https://supabase.com)'de durur. Sitedeki Supabase anahtarı herkese açık olabilir; kim neyi görebilir ve değiştirebilir, veritabanındaki RLS kuralları belirler.

## Kurulum

1. Supabase'de **SQL Editor**'de önce `supabase/schema.sql`'i, sonra `supabase/migrations/` içindekileri sırayla çalıştır.
2. Vercel'de proje ayarları: **Root Directory** = `web`, **Framework** = Next.js.
3. Vercel ortam değişkenleri:
   - `TMDB_KEY`: film / dizi araması
   - `STEAM_KEY`: Steam'den içe aktarma ([buradan alınır](https://steamcommunity.com/dev/apikey))
   - İsteğe bağlı: `RAWG_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (girilmezse koddaki varsayılanlar kullanılır)

## Yerel çalıştırma

```bash
cd web
npm install
npm run dev
```

`web/.env.local` içine `TMDB_KEY=...` (ve istersen `STEAM_KEY=...`) yaz. Gerçek veritabanına dokunmadan denemek için `ANCALOG_MOCK=1` ile çalıştır; o zaman `web/dev/mock-supabase.ts` (git'e girmez) sahte veritabanı olarak kullanılır.
