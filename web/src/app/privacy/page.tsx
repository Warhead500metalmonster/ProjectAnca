import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Gizlilik ve KVKK · Ancalog" };

const UPDATED = "31 Ekim 2026";

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
          <li>Kimin ne göreceğini sen seçersin: profilin herkese açık, sadece arkadaşlara açık ya da gizli olabilir. Gizli listelerin, engel listen ve mesajların yalnızca senin (ve mesajlaştığın kişinin).</li>
          <li>Raporların sadece yönetime gider; raporladığın kişi kimin raporladığını öğrenmez.</li>
          <li>Hesabını istediğin an <b>Ayarlar → Hesap → Hesabımı sil</b> ile kalıcı olarak silebilir, silmeden önce <b>Verilerimi indir</b> ile bir kopyasını alabilirsin.</li>
          <li>Bir mesajlaşmayı raporlarsan, haksız karar verilmesin diye yönetim o sohbetin tamamını görür. Raporlanmayan mesajlar okunmaz.</li>
          <li>Herkese açık profillerin kullanıcı adı ve sayıları Sıralamalar&apos;da görünür; istemezsen profilini gizleyebilirsin.</li>
          <li>Başka sitelerden aktarırken hiçbir sitenin şifresi istenmez. PlayStation ve Backloggd düğmeleri ile dosyalar senin tarayıcında çalışır; sunucuya sadece sonuçtaki oyun / film listesi kaydedilir.</li>
          <li>Yetkili makamlar kanuna uygun olarak isterse, mesajlar dahil kayıtlar onlarla paylaşılır. Herkes kendi yazdığından sorumludur.</li>
        </ul>
      </div>

      <p>Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında, Ancalog&apos;u kullanırken hangi kişisel verilerinin
        neden ve nasıl işlendiğini anlatır. Ancalog arkadaşlar arasında başlamış, ticari olmayan, ücretsiz bir hobi sitesidir.
        Veri sorumlusu, Ancalog&apos;un sahibi ve yöneticisidir (<Link href="/u/arno4436">@arno4436</Link>).</p>

      <h2>1. Hangi verileri işliyoruz?</h2>
      <ul>
        <li><b>Hesap bilgileri:</b> e-posta adresin, şifren (şifrelenmiş olarak), kullanıcı adın ve görünen adın.</li>
        <li><b>Profil bilgileri (hepsi isteğe bağlı):</b> hakkında yazısı, konum, zamirler, sosyal medya bağlantıları, profil fotoğrafı / kapak / arka plan linkleri ve kadrajları, profil şarkısı ve seçtiğin kısmı, tema ve renk seçimlerin, yıllık hedeflerin.</li>
        <li><b>Kullanım içeriğin:</b> kayıtların, puanların, sürelerin, tarihlerin, notların, etiketlerin, incelemelerin, listelerin, favorilerin, beğenilerin, yorumların, takiplerin ve rozetlerin.</li>
        <li><b>Etkinlikler:</b> katıldığın etkinlikler, seçtiğin sürüm, durumun, bitirme tarihin, notun, etkinlik sohbetine yazdıkların ve etkinlik rozetlerin.</li>
        <li><b>Mesajların ve forum yazıların:</b> karşılıklı takipleştiğin kişilerle ve kurucuyla yazışmaların, forumda açtığın konular ve yazdığın cevaplar, hangi mesaja yanıt verdiğin ve yazılara eklediğin fotoğraf linkleri.</li>
        <li><b>Gizlilik ve güvenlik tercihlerin:</b> profil gizlilik seçimin (herkese açık / sadece arkadaşlar / gizli), profilde gizlediğin türler ve engellediğin kişilerin listesi.</li>
        <li><b>Raporlar:</b> bir şeyi raporladığında; raporlayan olarak hesabın, raporlanan içeriğin türü ve kimliği, sahibinin hesabı, seçtiğin sebep, isteğe bağlı notun ve
          raporlanan yazının o anki hali (yazı sonradan silinse de yönetim inceleyebilsin diye). Bir mesajlaşmayı raporlarsan, haksız karar verilmesin diye yöneticiler o iki kişi arasındaki sohbetin tamamını görebilir.</li>
        <li><b>Son görülme zamanın:</b> yalnızca sitedeki çevrimiçi ve aktif üye sayısını hesaplamak için tutulur, kimseye gösterilmez; hesabını silince silinir.</li>
        <li><b>Yönetim kayıtları:</b> sana gönderilen uyarılar ve okuyup okumadığın, susturma süresi, yönetimin verdiği rozetler.</li>
        <li><b>İçe aktarma:</b> yalnızca senin başlattığın aktarımda ve yalnızca kütüphanene eklenecek bilgiler (içerik adı, durum, puan, süre, tarih, not, platform) alınır.
          <ul>
            <li>Steam: herkese açık oyun listen, oynama sürelerin, son oynama tarihin ve istersen başarım oranların (Steam Web API).</li>
            <li>Xbox: yazdığın gamertag ile herkese açık oyun listen ve başarımların (OpenXBL aracılığıyla).</li>
            <li>Last.fm, Spotify albüm linki, Simkl: yazdığın kullanıcı adı, link ya da bağlantı kodu ile o hizmetten liste alınır.</li>
            <li>PlayStation, Backloggd ve Serializd: düğme senin tarayıcında, senin açtığın sayfada çalışır; topladığı listeyi sen kopyalayıp yapıştırırsın. Ancalog sunucusu bu sitelere bağlanmaz.</li>
            <li>HowLongToBeat, Playnite, Letterboxd ve Spotify dosyaları ile yapıştırılan listeler senin tarayıcında okunur, dosyanın kendisi sunucuya yüklenmez.</li>
          </ul>
          Profil linkin, gamertag&apos;in, kullanıcı adların, dosyaların ve yapıştırdığın metin saklanmaz; yalnızca sonuçta kütüphanene eklenen kayıtlar saklanır.
          Tek istisna: Steam otomatik güncellemeyi kendin açarsan Steam kimliğin, sen kapatana ya da hesabını silene kadar saklanır ve sadece sana görünür.</li>
        <li><b>Toplamadıklarımız:</b> gerçek adın (yazmadıkça), telefon numaran, kimlik bilgilerin, konum (GPS) bilgin, ödeme bilgin, rehberin. Siteyi kullanırken nereye tıkladığını izleyen bir analiz aracı kullanılmaz.</li>
      </ul>

      <h2>2. Neden işliyoruz? (Amaç ve hukuki sebep)</h2>
      <ul>
        <li>Hesabını açmak, giriş yapmanı sağlamak ve siteyi sunmak: sözleşmenin kurulması ve ifası (KVKK m.5/2-c).</li>
        <li>Siteyi güvende tutmak, kötüye kullanımı, spam&apos;i ve kurallara aykırı içeriği önlemek; raporları incelemek, uyarı ve yaptırım uygulamak, engellemeleri uygulamak: meşru menfaat (KVKK m.5/2-f).
          Bu amaçla kurallar nedeniyle kapatılan hesapların e-posta adresi, tekrar kayıt olunmasını engellemek için saklanabilir.</li>
        <li>Hak ihlali bildirimlerini incelemek ve 5651 sayılı Kanun kapsamındaki yer sağlayıcı yükümlülüklerini yerine getirmek: hukuki yükümlülük (KVKK m.5/2-ç).</li>
        <li>Kanuni yükümlülükleri yerine getirmek, yetkili makamların hukuka uygun taleplerine yanıt vermek: kanunlarda açıkça öngörülme ve hukuki yükümlülük (KVKK m.5/2-a, ç).</li>
      </ul>
      <p>Verilerin reklam, profilleme ya da pazarlama için kullanılmaz, satılmaz, kiralanmaz. Uyum yüzdeleri ve sıralamalar yalnızca herkese açık kayıtlardan,
        sitenin kendi içinde hesaplanır; dışarıyla paylaşılmaz. Herkese açık profillerin kullanıcı adı, fotoğrafı ve kayıt, bitirme ve süre sayıları Sıralamalar sayfasında herkese görünür.
        Gizli ya da sadece arkadaşlara açık profiller kişi sıralamalarında yer almaz. Ana sayfadaki site sayıları yalnızca toplamlardır, kimseyi göstermez.</p>
      <p><b>Otomatik karar yok:</b> hakkında otomatik bir sistemle aleyhine sonuç doğuran bir karar verilmez. Uyarı, içerik silme, susturma ve hesap kapatma kararlarını her zaman bir insan, raporu okuyarak verir.</p>
      <p>Ancalog kâr amacı gütmeyen, tek kişinin yürüttüğü bir hobi projesidir. Kişisel verilerini korumak için makul teknik ve idari önlemler alınır;
        ancak profesyonel bir kurumun sunabileceği güvenlik ve süreklilik garanti edilemez. Hassas bilgilerini (kimlik, adres, telefon, sağlık bilgisi gibi)
        siteye yazmamanı öneririz; yazdığın her şeyden sen sorumlusun.</p>

      <h2>3. Kimler görebilir?</h2>
      <ul>
        <li><b>Herkes:</b> profilin herkese açıksa kayıtların, puanların, incelemelerin, rozetlerin, açık listelerin ve sıralamalardaki yerin; ayrıca forumda, etkinlik sohbetlerinde ve başkalarının kayıtlarına yazdıkların.
          Bir etkinliğe katıldığında etkinlik sayfasında adın, seçtiğin sürüm, durumun ve notun görünür; bu, profilin gizli olsa da geçerlidir (istemezsen etkinliğe katılma ya da ayrıl).
          Bunlar giriş yapmamış ziyaretçilere de görünür.</li>
        <li><b>Profilin gizliyse ya da sadece arkadaşlara açıksa:</b> diğerleri yalnızca adını, kullanıcı adını, fotoğrafını, kapağını, arka planını, rozetlerini, kaçıncı üye olduğunu ve profil şarkını görür.
          Kayıtların, listelerin ve istatistiklerin onlara gösterilmez; bu kural veritabanı düzeyinde uygulanır.</li>
        <li><b>Sadece sen:</b> e-posta adresin, gizli listelerin, engellediğin kişilerin listesi, sana gelen uyarılar, sadece senin gördüğün site rengi. Engellediğin kişiye bildirim gitmez.</li>
        <li><b>Sen ve yönetim:</b> gönderdiğin raporlar ve sana gelen uyarılar. Raporlanan kişiye kimin raporladığı söylenmez.</li>
        <li><b>Sen ve mesajlaştığın kişi:</b> mesajların. Mesajlar uçtan uca şifreli değildir; teknik olarak veritabanında saklanır. Site yöneticileri mesajları okumaz. İki istisna vardır: bir mesajlaşma raporlanırsa, raporu incelemek için o iki kişi arasındaki sohbetin tamamı yöneticilere görünür; bir de kanuni bir zorunluluk olursa.</li>
        <li><b>Yetkili makamlar:</b> mahkemeler, savcılıklar, kolluk ve diğer yetkili kamu kurum ve kuruluşları kanuna uygun olarak talep ederse; hesap bilgilerin, paylaştığın içerikler,
          mesaj kayıtların ve altyapı sağlayıcılarının tuttuğu teknik kayıtlar (giriş zamanları, IP adresleri gibi) bu makamlarla paylaşılır (KVKK m.8/2 ve m.28).</li>
        <li><b>Yöneticiler:</b> kurucu ve atadığı yöneticiler. Raporları ve raporlara eklenen yazıları görür, herkese açık içerikleri düzenleyebilir ya da kaldırabilir, uyarı gönderebilir;
          e-posta adresini ve şifreni göremez, raporlanmamış mesajlarını okumaz. Raporlanan bir sohbetin tamamını yalnızca o raporu incelemek için görür.</li>
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
        İçe aktarırken yalnızca yazdığın kimlik (Steam profil kimliği, Xbox gamertag&apos;i, Last.fm kullanıcı adı, Spotify albüm linki, Simkl kodu) ilgili hizmete
        (Steam, OpenXBL, Last.fm, Spotify, Simkl) sorulur. Bir profilde şarkı çaldığında oynatıcı YouTube&apos;dan yüklenir. Bu hizmetlerin kendi gizlilik kuralları geçerlidir.
        Şifre yenileme ve kayıt onayı e-postaları giriş sistemi üzerinden gönderilir.</p>
      <p><b>Fotoğraf linkleri ve dış görseller:</b> sohbetlere, foruma ve yorumlara yapıştırılan fotoğraflar ile profil fotoğrafı, kapak ve arka plan görselleri Ancalog&apos;da barındırılmaz, linkin ait olduğu siteden (Imgur, Discord gibi) yüklenir.
        Sayfayı açtığında tarayıcın o siteye bağlanır ve IP adresin o siteye görünebilir. Ancalog bu sitelerin ne kaydettiğini kontrol edemez.</p>
      <p>Bu sağlayıcıların sunucuları yurt dışında olabileceğinden verilerin yurt dışına aktarılabilir. Aktarım, hizmetin sunulabilmesi için gerekli olduğu ölçüde ve 6698 sayılı Kanun&apos;un 9. maddesi çerçevesinde yapılır.</p>

      <h2>6. Çerezler ve tarayıcı depolaması</h2>
      <p>Reklam ya da takip çerezi kullanılmaz. Tarayıcında yalnızca sitenin çalışması için gereken bilgiler saklanır:</p>
      <ul>
        <li>Oturumun (&quot;Beni hatırla&quot; seçersen tarayıcı kapanınca da açık kalır)</li>
        <li>Seçtiğin site rengi, profil şarkısı ses seviyen, kapattığın duyurular ve kartlar, liste ya da ızgara görünümü tercihin</li>
        <li>Bildirimleri açtıysan bu tercihin ve bildirime tıklayınca doğru sayfayı açan küçük bir arka plan dosyası (service worker). Bildirim izni tarayıcından verilir, istediğin an geri alabilirsin.</li>
      </ul>
      <p>Profil şarkıları YouTube&apos;un gizlilik dostu (youtube-nocookie.com) oynatıcısıyla çalınır; bu oynatıcıya
        {" "}<a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google Gizlilik Politikası</a> uygulanır.</p>

      <h2>7. Ne kadar saklanıyor?</h2>
      <ul>
        <li>Verilerin hesabın açık olduğu sürece saklanır. Son görülme zamanının yalnızca en sonuncusu tutulur, geçmişi tutulmaz.</li>
        <li><b>Hesabını sildiğinde</b> profilin, kayıtların, listelerin, yorumların, beğenilerin, mesajların, etkinlik katılımların ve yazıların, takiplerin, rozetlerin, Steam kimliğin ve son görülme zamanın hemen ve kalıcı olarak silinir. Altyapı sağlayıcısının teknik yedeklerinden de en geç birkaç hafta içinde kendiliğinden çıkar.</li>
        <li>Ortak katalogdaki içerikler (aramada olmadığı için elle eklediğin şarkılar gibi) başkaları da kullandığı için kalır; ekleyen bilgisi silinir.</li>
        <li>Kurallar nedeniyle kapatılan hesapların e-posta adresi, tekrar kayıt olmayı engellemek için saklanabilir. Susturma kararları süresi bitene kadar profilde tutulur.</li>
        <li>Raporlar incelenip kapandıktan sonra da, aynı kişi hakkındaki yeni raporları değerlendirebilmek için saklanabilir. Raporlayan hesabını silerse gönderdiği raporlar da silinir;
          raporlanan kişi hesabını silerse rapordaki hesap bağlantısı kalkar. Uyarılar ve engel listen hesabınla birlikte silinir.</li>
      </ul>

      <h2>8. Hakların (KVKK m.11)</h2>
      <p>Kişisel verilerinin işlenip işlenmediğini öğrenme, bilgi isteme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,
        aktarıldığı kişileri bilme, eksik ya da yanlışsa düzeltilmesini, silinmesini ya da yok edilmesini isteme, bunların aktarıldığı kişilere bildirilmesini isteme,
        otomatik sistemlerle analiz sonucu aleyhine bir sonuç çıkmasına itiraz etme ve zarara uğradıysan giderilmesini talep etme hakların vardır.</p>
      <ul>
        <li>Bilgilerini <Link href="/settings">Ayarlar</Link>&apos;dan düzeltebilir, <b>Ayarlar → Hesap → Verilerimi indir</b> ile tümünün bir kopyasını Excel / CSV, JSON ya da Letterboxd biçiminde alıp başka bir yere taşıyabilir (veri taşınabilirliği), <b>Hesabımı sil</b> ile silebilirsin.</li>
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
