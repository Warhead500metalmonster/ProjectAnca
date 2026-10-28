import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Gizlilik ve KVKK · Ancalog" };

const UPDATED = "28 Ekim 2026";

export default function Privacy() {
  return (
    <article className="legal">
      <h1>Gizlilik ve KVKK Aydınlatma Metni</h1>
      <p className="muted">Son güncelleme: {UPDATED}</p>

      <div className="legal-summary">
        <b>Kısaca</b>
        <ul>
          <li>Reklam yok, veri satışı yok, takip çerezi yok.</li>
          <li>Şifreni kimse göremez, biz de dahil: şifrelenmiş (hash&apos;lenmiş) olarak saklanır.</li>
          <li>E-posta adresin hiçbir yerde görünmez.</li>
          <li>Herkese açık olan: profilin, kayıtların, puanların, incelemelerin, yorumların ve açık listelerin. Gizli listelerin ve mesajların yalnızca senin (ve mesajlaştığın kişinin).</li>
          <li>Hesabını istediğin an <b>Ayarlar → Hesabımı sil</b> ile kalıcı olarak silebilir, silmeden önce <b>Verilerimi indir</b> ile bir kopyasını alabilirsin.</li>
          <li>Steam&apos;den aktarırken Steam şifren istenmez; yalnızca herkese açık oyun listen okunur.</li>
        </ul>
      </div>

      <p>Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında, Ancalog&apos;u kullanırken hangi kişisel verilerinin
        neden ve nasıl işlendiğini anlatır. Ancalog arkadaşlar arasında başlamış, ticari olmayan, ücretsiz bir hobi sitesidir.
        Veri sorumlusu, Ancalog&apos;un sahibi ve yöneticisidir (<Link href="/u/arno4436">@arno4436</Link>).</p>

      <h2>1. Hangi verileri işliyoruz?</h2>
      <ul>
        <li><b>Hesap bilgileri:</b> e-posta adresin, şifren (şifrelenmiş olarak), kullanıcı adın ve görünen adın.</li>
        <li><b>Profil bilgileri (hepsi isteğe bağlı):</b> hakkında yazısı, konum, zamirler, sosyal medya bağlantıları, profil fotoğrafı / kapak / arka plan linkleri, profil şarkısı, tema ve renk seçimlerin, yıllık hedeflerin.</li>
        <li><b>Kullanım içeriğin:</b> kayıtların, puanların, sürelerin, tarihlerin, notların, incelemelerin, listelerin, favorilerin, beğenilerin, yorumların, takiplerin ve rozetlerin.</li>
        <li><b>Mesajların:</b> karşılıklı takipleştiğin kişilerle yazışmaların.</li>
        <li><b>İçe aktarma:</b> Steam&apos;den aktarırsan yalnızca oyun listen, oynama sürelerin ve son oynama tarihin; Letterboxd&apos;dan aktarırsan seçtiğin dosyadaki film adları, puanlar, tarihler ve incelemeler alınır. Steam profil linkin ve Letterboxd dosyan saklanmaz; dosya senin tarayıcında okunur, sunucuya yüklenmez.</li>
        <li><b>Toplamadıklarımız:</b> gerçek adın (yazmadıkça), telefon numaran, kimlik bilgilerin, konum (GPS) bilgin, ödeme bilgin, rehberin. Siteyi kullanırken nereye tıkladığını izleyen bir analiz aracı kullanılmaz.</li>
      </ul>

      <h2>2. Neden işliyoruz? (Amaç ve hukuki sebep)</h2>
      <ul>
        <li>Hesabını açmak, giriş yapmanı sağlamak ve siteyi sunmak: sözleşmenin kurulması ve ifası (KVKK m.5/2-c).</li>
        <li>Siteyi güvende tutmak, kötüye kullanımı, spam&apos;i ve kurallara aykırı içeriği önlemek: meşru menfaat (KVKK m.5/2-f). Bu amaçla kurallar nedeniyle kapatılan hesapların e-posta adresi, tekrar kayıt olunmasını engellemek için saklanabilir.</li>
        <li>Kanuni yükümlülükleri yerine getirmek, yetkili makamların hukuka uygun taleplerine yanıt vermek: kanunlarda açıkça öngörülme ve hukuki yükümlülük (KVKK m.5/2-a, ç).</li>
      </ul>
      <p>Verilerin reklam, profilleme ya da pazarlama için kullanılmaz, satılmaz, kiralanmaz.</p>

      <h2>3. Kimler görebilir?</h2>
      <ul>
        <li><b>Herkes:</b> profilin, kayıtların, puanların, incelemelerin, yorumların, rozetlerin ve açık listelerin. Bunlar giriş yapmamış ziyaretçilere de görünür.</li>
        <li><b>Sadece sen:</b> e-posta adresin, gizli listelerin, sadece senin gördüğün site rengi.</li>
        <li><b>Sen ve mesajlaştığın kişi:</b> mesajların. Mesajlar uçtan uca şifreli değildir; teknik olarak veritabanında saklanır. Site yöneticileri mesajları okumaz; yalnızca bir şikâyeti incelemek ya da kanuni bir zorunluluk gibi istisnai durumlarda bakılabilir.</li>
        <li><b>Yöneticiler:</b> herkese açık içerikleri düzenleyebilir ya da kaldırabilir; e-posta adresini ve şifreni göremez.</li>
      </ul>

      <h2>4. Güvenlik</h2>
      <ul>
        <li>Site yalnızca şifreli bağlantı (HTTPS) ile çalışır.</li>
        <li>Şifreler geri çevrilemez biçimde şifrelenerek (hash) saklanır; kimse göremez.</li>
        <li>Veritabanında satır düzeyinde güvenlik kuralları vardır: bir kullanıcı yalnızca kendi kayıtlarını, listelerini ve profilini değiştirebilir; başkasının gizli listesini ya da mesajlarını göremez.</li>
        <li>Steam, TMDB ve RAWG gibi servislerin anahtarları sunucuda tutulur, tarayıcına gönderilmez.</li>
        <li>Hiçbir sistem kusursuz değildir. Bir veri ihlali olursa, KVKK&apos;ya uygun olarak en kısa sürede etkilenen kullanıcılara ve Kişisel Verileri Koruma Kurulu&apos;na bildirim yapılır.</li>
      </ul>

      <h2>5. Verilerin nerede tutuluyor? (Aktarım)</h2>
      <p>Ancalog, hizmeti sunabilmek için şu altyapı sağlayıcılarını kullanır; verilerin bunların sunucularında (yurt dışında olabilir) saklanır ya da işlenir:</p>
      <ul>
        <li><a href="https://supabase.com/privacy" target="_blank" rel="noopener">Supabase</a>: veritabanı ve giriş sistemi</li>
        <li><a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener">Vercel</a>: sitenin barındırılması</li>
      </ul>
      <p>Arama ve bilgi için şu servislere <b>yalnızca aradığın kelime</b> gönderilir, kişisel bilgin gönderilmez: RAWG, TMDB, AniList, Apple (iTunes), Deezer.
        Steam&apos;den aktarırken yalnızca Steam profil kimliğin Steam&apos;e sorulur. Bir profilde şarkı çaldığında oynatıcı YouTube&apos;dan yüklenir.
        Hesap oluşturarak verilerinin bu hizmetin sunulabilmesi için bu sağlayıcılara aktarılmasını kabul etmiş olursun.</p>

      <h2>6. Çerezler ve tarayıcı depolaması</h2>
      <p>Reklam ya da takip çerezi kullanılmaz. Tarayıcında yalnızca sitenin çalışması için gereken bilgiler saklanır:</p>
      <ul>
        <li>Oturumun (&quot;Beni hatırla&quot; seçersen tarayıcı kapanınca da açık kalır)</li>
        <li>Seçtiğin site rengi, profil şarkısı ses seviyen ve kapattığın duyurular</li>
      </ul>
      <p>Profil şarkıları YouTube&apos;un gizlilik dostu (youtube-nocookie.com) oynatıcısıyla çalınır; bu oynatıcıya
        {" "}<a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google Gizlilik Politikası</a> uygulanır.</p>

      <h2>7. Ne kadar saklanıyor?</h2>
      <ul>
        <li>Verilerin hesabın açık olduğu sürece saklanır.</li>
        <li><b>Hesabını sildiğinde</b> profilin, kayıtların, listelerin, yorumların, beğenilerin, mesajların, takiplerin ve rozetlerin hemen ve kalıcı olarak silinir. Altyapı sağlayıcısının teknik yedeklerinden de en geç birkaç hafta içinde kendiliğinden çıkar.</li>
        <li>Ortak katalogdaki içerikler (aramada olmadığı için elle eklediğin şarkılar gibi) başkaları da kullandığı için kalır; ekleyen bilgisi silinir.</li>
        <li>Kurallar nedeniyle kapatılan hesapların e-posta adresi, tekrar kayıt olmayı engellemek için saklanabilir.</li>
      </ul>

      <h2>8. Hakların (KVKK m.11)</h2>
      <p>Kişisel verilerinin işlenip işlenmediğini öğrenme, bilgi isteme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,
        aktarıldığı kişileri bilme, eksik ya da yanlışsa düzeltilmesini, silinmesini ya da yok edilmesini isteme, bunların aktarıldığı kişilere bildirilmesini isteme,
        otomatik sistemlerle analiz sonucu aleyhine bir sonuç çıkmasına itiraz etme ve zarara uğradıysan giderilmesini talep etme hakların vardır.</p>
      <ul>
        <li>Bilgilerini <Link href="/settings">Ayarlar</Link>&apos;dan düzeltebilir, <b>Verilerimi indir</b> ile tümünün bir kopyasını alabilir, <b>Hesabımı sil</b> ile silebilirsin.</li>
        <li>Diğer talepler için site yöneticisine Ancalog üzerinden ulaş: <Link href="/u/arno4436">@arno4436</Link>. Talebin en geç 30 gün içinde ücretsiz olarak yanıtlanır.</li>
        <li>Yanıttan memnun kalmazsan <a href="https://www.kvkk.gov.tr" target="_blank" rel="noopener">Kişisel Verileri Koruma Kurulu</a>&apos;na şikâyette bulunabilirsin.</li>
      </ul>

      <h2>9. Çocuklar</h2>
      <p>Ancalog 13 yaşından küçükler için değildir. 18 yaşından küçüksen siteyi velinin bilgisiyle kullanmalısın.
        13 yaşından küçük birinin hesap açtığını fark edersek hesabı ve verilerini sileriz.</p>

      <h2>10. Değişiklikler</h2>
      <p>Bu metin güncellenebilir. Önemli bir değişiklik olursa sitenin üstündeki duyuru alanında haber verilir; güncel hali her zaman bu sayfadadır.</p>

      <p className="muted"><Link href="/terms">Kullanım Koşulları →</Link></p>
    </article>
  );
}
