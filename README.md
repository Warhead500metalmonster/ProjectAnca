# 📒 Ancalog

Oyun, film, dizi, müzik ve anime günlüğü + topluluk. Oynadığın, izlediğin, dinlediğin her şeyi logla, puanla, arkadaşlarını takip et.

🌐 **Site:** https://warhead500metalmonster.github.io/ProjectAnca/

## Özellikler

- 🎮 Oyun · 🎬 Film · 📺 Dizi · 🎵 Müzik · 🌸 Anime
- E-posta + şifre ile hesap, profil sayfası (avatar, bio)
- Ana sayfa: kendi özetin, devam ettiklerin, arkadaşlarının ve topluluğun son hareketleri
- Topluluk: son hareketler, popüler oyunlar, üye arama, takip etme
- Oyun sayfası: oyunu Ancalog'da kimlerin logladığı ve ortalama puan
- Oyunlar sadece [RAWG](https://rawg.io) aramasından seçilir; kapak, yıl ve geliştirici otomatik gelir
- Durum, yarım yıldızlı puan, tarih ve notlar
- Verilerini JSON olarak indirme

## Yapı

| Dosya | Ne işe yarar |
|---|---|
| `index.html`, `style.css`, `app.js` | Site (GitHub Pages'te statik olarak yayınlanır) |
| `config.js` | Supabase adresi/anahtarı ve RAWG anahtarı |
| `supabase/schema.sql` | Veritabanı tabloları ve güvenlik kuralları |

Veriler [Supabase](https://supabase.com)'de durur. `config.js`'teki *anon* anahtar herkese açık olabilir; kim neyi değiştirebilir, `schema.sql`'deki RLS kuralları belirler.

## Kurulum

1. Supabase'de proje aç, **SQL Editor**'de `supabase/schema.sql`'i çalıştır.
2. **Authentication → Sign In / Providers → Email** altında "Confirm email"i istersen kapat.
3. **Project Settings → API**'deki Project URL ve anon key'i `config.js`'e yaz.
4. Push'la. Güncellemelerde `index.html`'deki `?v=` numaralarını artır, yoksa tarayıcılar eski dosyayı kullanabilir.

## Yerel test

`dev/` klasörü ve `test.html` git'e girmez. `test.html`, Supabase yerine `dev/mock-supabase.js`'teki sahte veritabanıyla çalışır:

```bash
python -m http.server 8080
```

Sonra `http://localhost:8080/test.html` adresini aç.
