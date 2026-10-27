# 📒 Ancalog

Oyun, film, dizi, müzik ve anime günlüğü + topluluk. Oynadığın, izlediğin, dinlediğin her şeyi logla, puanla, listeler yap, arkadaşlarını takip et.

🌐 **Site:** https://ancalog.vercel.app

## Özellikler

- 🎮 Oyun · 🎬 Film · 📺 Dizi · 🎵 Müzik · 🌸 Anime
- Arama: oyunlar [RAWG](https://rawg.io), film ve diziler [TMDB](https://www.themoviedb.org), animeler [AniList](https://anilist.co), müzik Apple Music
- Kayıtta platform, mağaza (Direct Download dahil), emülatör, başlama/bitirme tarihi, kaç günde bitti, süre ve ilerleme (saat-dakika-saniye), not, inceleme
- 5 ya da 10 üzerinden puan: herkes puanları kendi seçtiği ölçekte görür; başkasının kaydında kendi puanınla karşılaştırma
- İncelemelere beğeni ve yorum, bildirimler
- Listeler (açık / gizli): listedekilerin kaçını bitirdiğin yüzdesiyle
- Profil: rozetler (👑 site sahibi, 🌟 öncü), favoriler (her kategoriden 10), renk, kapak görseli, sosyal bağlantılar
- Kütüphanede birden çok filtre bir arada (durum, çıkış yılı, bitirme yılı, platform, puan…) ve sıralama
- Tüm zamanlar istatistikleri: türe, çıkış yılına ve bitirme yılına göre
- Keşfet: içerik ve kişi arama; çıkış yılı + "en çok bitirilen" gibi filtreler birlikte
- Karşılıklı takipleşen arkadaşlarla mesajlaşma
- "Beni hatırla" ile oturum

## Yapı

| Klasör | Ne işe yarar |
|---|---|
| `web/` | Site (Next.js). Vercel bu klasörü yayınlar. |
| `supabase/schema.sql` | İlk veritabanı şeması |
| `supabase/migrations/` | Sonraki veritabanı değişiklikleri, sırayla çalıştırılır |
| `index.html`, `app.js`, `style.css` | Eski düz HTML sürüm (Vercel'in kök klasörü `web` yapılınca kaldırılabilir) |

Veriler [Supabase](https://supabase.com)'de durur. Sitedeki Supabase anahtarı herkese açık olabilir; kim neyi değiştirebilir, veritabanındaki RLS kuralları belirler.

## Kurulum

1. Supabase'de **SQL Editor**'de önce `supabase/schema.sql`'i, sonra `supabase/migrations/` içindekileri sırayla çalıştır.
2. Vercel'de proje ayarları: **Root Directory** = `web`, **Framework** = Next.js.
3. Vercel ortam değişkeni: `TMDB_KEY` (film/dizi araması için). İstersen `RAWG_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` de girilebilir; girilmezse koddaki varsayılanlar kullanılır.

## Yerel çalıştırma

```bash
cd web
npm install
npm run dev
```

`web/.env.local` içine `TMDB_KEY=...` yaz. Gerçek veritabanına dokunmadan denemek için `ANCALOG_MOCK=1` ile çalıştır; o zaman `web/dev/mock-supabase.ts` (git'e girmez) sahte veritabanı olarak kullanılır.
