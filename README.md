# 📒 Ancalog

Oyun, film, dizi, müzik ve anime günlüğü. Oynadığın, izlediğin, dinlediğin her şeyi puanla, not al, takip et.

## Özellikler

- 🎮 Oyun · 🎬 Film · 📺 Dizi · 🎵 Müzik · 🌸 Anime
- Durum: Bitti / Devam ediyor / Planlandı / Ara verdim / Bıraktım
- Yarım yıldızlı 5 üzerinden puan, notlar, kapak görseli
- Arama (`/` kısayolu), filtreleme, sıralama, istatistikler
- JSON olarak dışa / içe aktarma (yedek ya da başka cihaza taşıma için)

Veriler tarayıcının `localStorage`'ında saklanır, sunucu yok. Tarayıcı verilerini silersen kayıtlar da gider, ara ara **Dışa aktar** ile yedek al.

## GitHub Pages'te yayınlama

1. GitHub'da yeni bir repo aç (ör. `ancalog`).
2. Bu klasörü o repoya pushla:
   ```bash
   git remote add origin https://github.com/KULLANICI_ADIN/ancalog.git
   git push -u origin main
   ```
3. Repo → **Settings → Pages** → *Source: Deploy from a branch* → `main` / `(root)` → **Save**.
4. Bir dakika sonra site `https://KULLANICI_ADIN.github.io/ancalog/` adresinde açılır.

## Yerelde çalıştırma

`index.html`'i tarayıcıda açman yeterli.
