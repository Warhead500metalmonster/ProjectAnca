import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Kullanım Koşulları · Ancalog" };

// Son güncelleme tarihini metin değişince güncelle
const UPDATED = "28 Ekim 2026";

export default function Terms() {
  return (
    <article className="legal">
      <h1>Kullanım Koşulları</h1>
      <p className="muted">Son güncelleme: {UPDATED}</p>
      <p>Ancalog&apos;u (ancalog.vercel.app) kullanarak bu koşulları kabul etmiş olursun. Kabul etmiyorsan lütfen siteyi kullanma.</p>

      <h2>1. Hizmet</h2>
      <p>Ancalog; oyun, film, dizi, müzik ve anime kayıtlarını tutmaya, puanlamaya ve arkadaşlarla paylaşmaya yarayan, ücretsiz ve hobi amaçlı bir sitedir.
        Site &quot;olduğu gibi&quot; sunulur; kesintisiz çalışacağı, hatasız olacağı ya da verilerin hiç kaybolmayacağı garanti edilmez.
        Önemli kayıtlarını <b>Ayarlar → Verilerimi indir</b> ile ara ara yedeklemeni öneririz. Site, haber vermeden değiştirilebilir ya da kapatılabilir.</p>

      <h2>2. Hesap</h2>
      <ul>
        <li>Siteyi kullanmak için en az <b>13 yaşında</b> olmalısın. 18 yaşından küçüksen velinin bilgisi ve onayıyla kullanmalısın.</li>
        <li>Hesabının ve şifrenin güvenliğinden sen sorumlusun. Başkasının adına ya da başkasını taklit eden hesap açamazsın.</li>
        <li>Hesabını istediğin zaman <b>Ayarlar → Hesabımı sil</b> ile kalıcı olarak silebilirsin.</li>
      </ul>

      <h2>3. Kurallar</h2>
      <p>Aşağıdakileri paylaşmak (inceleme, yorum, mesaj, liste, kullanıcı adı, profil görseli, arka plan, profil şarkısı dahil) yasaktır:</p>
      <ul>
        <li>Hakaret, taciz, tehdit, nefret söylemi ya da ayrımcılık içeren içerikler</li>
        <li>Müstehcen, şiddet içeren ya da reşit olmayanlara uygun olmayan içerikler</li>
        <li>Başkasının kişisel bilgileri (adres, telefon, kimlik bilgisi vb.)</li>
        <li>Telif hakkıyla korunan içeriğin izinsiz paylaşımı ya da korsan içeriğe bağlantı</li>
        <li>Türkiye Cumhuriyeti kanunlarına aykırı her türlü içerik</li>
        <li>Spam, reklam, sahte hesap ve sitenin işleyişini bozmaya yönelik girişimler</li>
      </ul>
      <p>Yöneticiler, bu kurallara aykırı içeriği haber vermeden kaldırabilir, kullanıcı adlarını yasaklayabilir ve hesapları kapatabilir.</p>

      <h2>4. Paylaştığın içerik</h2>
      <p>Yazdığın incelemelerin, yorumların ve listelerin sahibi sensin; içeriklerinden sen sorumlusun. Paylaştığın içeriğin sitede gösterilmesine
        izin vermiş olursun. Herkese açık profil, kayıt, inceleme, yorum ve açık listeler herkes tarafından görülebilir.</p>

      <h2>5. Telif hakları ve markalar</h2>
      <p>Oyun, film, dizi, albüm ve anime adları, kapak görselleri ve açıklamaları ilgili hak sahiplerine aittir ve yalnızca tanıtım ve bilgi amacıyla gösterilir.
        Bilgiler <a href="https://rawg.io" target="_blank" rel="noopener">RAWG</a>, <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a>,
        {" "}<a href="https://anilist.co" target="_blank" rel="noopener">AniList</a>, Apple Music (iTunes) ve Deezer&apos;dan alınır. Bu site TMDB API&apos;sini kullanır ancak TMDB tarafından onaylanmış değildir.
        Profil şarkıları YouTube oynatıcısıyla çalınır; bu kullanımda <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">YouTube Hizmet Şartları</a> geçerlidir.
        Ancalog; RAWG, TMDB, AniList, Apple, Deezer, YouTube, Steam, Valve ya da Letterboxd ile bağlantılı değildir ve bu şirketler tarafından desteklenmez.</p>
      <p>Hakkını ihlal eden bir içerik gördüysen aşağıdaki iletişim yolundan bildir; incelenip kaldırılır.</p>

      <h2>6. Sorumluluğun sınırı</h2>
      <p>Ancalog, kullanıcıların paylaştığı içeriklerden ve üçüncü taraf sitelere verilen bağlantılardan sorumlu değildir. Site ücretsiz sunulduğundan,
        kullanımından doğabilecek doğrudan ya da dolaylı zararlardan, kanunun izin verdiği ölçüde, sorumluluk kabul edilmez.</p>

      <h2>7. Değişiklikler ve uygulanacak hukuk</h2>
      <p>Bu koşullar güncellenebilir; güncel hali her zaman bu sayfadadır. Koşullar Türkiye Cumhuriyeti kanunlarına tabidir.</p>

      <h2>8. İletişim</h2>
      <p>Şikayet, telif bildirimi ve sorular için site yöneticisine Ancalog üzerinden ulaşabilirsin: <Link href="/u/arno4436">@arno4436</Link>.</p>

      <p className="muted"><Link href="/privacy">Gizlilik ve KVKK Aydınlatma Metni →</Link></p>
    </article>
  );
}
