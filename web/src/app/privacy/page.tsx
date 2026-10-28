import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Gizlilik ve KVKK · Ancalog" };

const UPDATED = "28 Ekim 2026";

export default function Privacy() {
  return (
    <article className="legal">
      <h1>Gizlilik ve KVKK Aydınlatma Metni</h1>
      <p className="muted">Son güncelleme: {UPDATED}</p>
      <p>Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında, Ancalog&apos;u kullanırken hangi kişisel verilerinin
        neden ve nasıl işlendiğini anlatır. Veri sorumlusu, Ancalog&apos;un sahibi ve yöneticisidir (<Link href="/u/arno4436">@arno4436</Link>).</p>

      <h2>1. Hangi verileri işliyoruz?</h2>
      <ul>
        <li><b>Hesap bilgileri:</b> e-posta adresin, şifren (şifrelenmiş olarak, biz göremeyiz), kullanıcı adın ve görünen adın.</li>
        <li><b>Profil bilgileri:</b> yazmayı seçersen hakkında yazısı, konum, zamirler, sosyal medya bağlantıları, profil fotoğrafı / kapak / arka plan linkleri, profil şarkısı ve tema seçimin.</li>
        <li><b>Kullanım içeriğin:</b> kayıtların, puanların, sürelerin, tarihlerin, incelemelerin, notların, listelerin, beğenilerin, yorumların, takiplerin ve hedeflerin.</li>
        <li><b>Mesajların:</b> arkadaşlarınla yazışmaların; yalnızca sen ve karşı taraf görebilir.</li>
        <li><b>İçe aktarma:</b> Steam ya da Letterboxd&apos;dan aktarırsan, yalnızca oyun / film listen, süreler, puanlar ve tarihler alınır. Steam profil linkin saklanmaz.</li>
      </ul>

      <h2>2. Neden işliyoruz? (Amaç ve hukuki sebep)</h2>
      <ul>
        <li>Hesabını açmak, giriş yapmanı sağlamak ve siteyi sunmak: sözleşmenin kurulması ve ifası (KVKK m.5/2-c).</li>
        <li>Siteyi güvende tutmak, kötüye kullanımı ve kurallara aykırı içeriği önlemek: meşru menfaat (KVKK m.5/2-f). Bu amaçla kapatılan hesapların e-posta adresi, tekrar kayıt olunmasını engellemek için saklanabilir.</li>
        <li>Kanuni yükümlülükleri yerine getirmek: kanunlarda açıkça öngörülme (KVKK m.5/2-a, ç).</li>
      </ul>
      <p>Verilerin reklam için kullanılmaz, satılmaz ve kimseyle pazarlama amacıyla paylaşılmaz.</p>

      <h2>3. Kimler görebilir?</h2>
      <p>Profilin, kayıtların, puanların, incelemelerin, yorumların ve herkese açık listelerin <b>herkese açıktır</b>. Gizli listelerin ve mesajların herkese açık değildir.
        E-posta adresin hiçbir yerde gösterilmez.</p>

      <h2>4. Verilerin nerede tutuluyor? (Aktarım)</h2>
      <p>Site, hizmet aldığı şu altyapı sağlayıcılarını kullanır ve verilerin onların sunucularında (yurt dışında olabilir) saklanır:
        <b> Supabase</b> (veritabanı ve giriş), <b>Vercel</b> (sitenin barındırılması). Arama yaptığında RAWG, TMDB, AniList, Apple (iTunes) ve Deezer&apos;a
        yalnızca aradığın kelime gönderilir; kişisel bilgin gönderilmez. Bir profilde şarkı çaldığında oynatıcı YouTube&apos;dan yüklenir.
        Hesap oluşturarak verilerinin bu hizmetin sunulabilmesi için bu sağlayıcılara aktarılmasını kabul etmiş olursun.</p>

      <h2>5. Çerezler ve tarayıcı depolaması</h2>
      <p>Reklam ya da takip çerezi kullanılmaz. Tarayıcında yalnızca sitenin çalışması için gereken bilgiler saklanır: oturumun (&quot;Beni hatırla&quot;),
        seçtiğin site rengi, profil şarkısı ses seviyen ve kapattığın duyurular. Profil şarkıları YouTube&apos;un gizlilik dostu (youtube-nocookie.com) oynatıcısıyla çalınır;
        bu oynatıcıya <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google Gizlilik Politikası</a> uygulanır.</p>

      <h2>6. Ne kadar saklanıyor?</h2>
      <p>Verilerin hesabın açık olduğu sürece saklanır. <b>Ayarlar → Hesabımı sil</b> ile hesabını sildiğinde profilin, kayıtların, listelerin, yorumların, beğenilerin,
        mesajların ve takiplerin kalıcı olarak silinir. Ortak katalog içerikleri (elle eklediğin şarkılar vb.) herkes kullandığı için ekleyen bilgisi kaldırılarak kalır.</p>

      <h2>7. Hakların (KVKK m.11)</h2>
      <p>Kişisel verilerinin işlenip işlenmediğini öğrenme, bilgi isteme, amacını öğrenme, aktarıldığı kişileri bilme, eksik ya da yanlışsa düzeltilmesini,
        silinmesini ya da yok edilmesini isteme, itiraz etme ve zarara uğradıysan giderilmesini talep etme hakların vardır.</p>
      <ul>
        <li>Bilgilerini <Link href="/settings">Ayarlar</Link>&apos;dan düzeltebilir, <b>Verilerimi indir</b> ile bir kopyasını alabilir, <b>Hesabımı sil</b> ile silebilirsin.</li>
        <li>Diğer talepler için site yöneticisine Ancalog üzerinden ulaş: <Link href="/u/arno4436">@arno4436</Link>. Talebin en geç 30 gün içinde yanıtlanır.</li>
      </ul>

      <h2>8. Çocuklar</h2>
      <p>Ancalog 13 yaşından küçükler için değildir. 13 yaşından küçük birinin hesap açtığını fark edersek hesabı sileriz.</p>

      <p className="muted"><Link href="/terms">Kullanım Koşulları →</Link></p>
    </article>
  );
}
