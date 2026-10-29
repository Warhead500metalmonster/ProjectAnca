import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Kullanım Koşulları · Ancalog" };

// Son güncelleme tarihini metin değişince güncelle
const UPDATED = "29 Ekim 2026";

export default function Terms() {
  return (
    <article className="legal">
      <h1>Kullanım Koşulları</h1>
      <p className="muted">Son güncelleme: {UPDATED}</p>

      <div className="legal-summary">
        <b>Kısaca</b>
        <ul>
          <li>Ancalog ücretsiz, reklamsız, kâr amacı gütmeyen ve yapay zekâ desteğiyle geliştirilen bir hobi sitesi. Hiçbir garanti verilmeden, &quot;olduğu gibi&quot; sunulur; kullanımı tamamen kendi sorumluluğundadır.</li>
          <li>Yazdıkların senin; kurallara uyduğun sürece istediğini logla, puanla, incele.</li>
          <li>Herkes kendi yazdığından sorumludur. Yetkili makamlar kanuna uygun olarak isterse kayıtlar (mesajlar dahil) onlarla paylaşılır.</li>
          <li>Hakaret, taciz, nefret söylemi, müstehcenlik, başkasının kişisel bilgisi ve korsan içerik yasak.</li>
          <li>Hesabını istediğin an kendin silebilirsin.</li>
          <li>Başka sitelerden içe aktarırken verinin sana ait olduğundan ve o sitenin kurallarına uyduğundan sen sorumlusun.</li>
          <li>Oyun, film ve albüm bilgileri ile kapakları hak sahiplerine ait; biz sadece gösteriyoruz.</li>
        </ul>
      </div>

      <p>Ancalog&apos;u (ancalog.vercel.app) kullanarak bu koşulları kabul etmiş olursun. Kabul etmiyorsan lütfen siteyi kullanma.
        Kişisel verilerinin nasıl işlendiğini <Link href="/privacy">Gizlilik ve KVKK Aydınlatma Metni</Link>&apos;nde bulabilirsin.</p>

      <h2>1. Hizmet</h2>
      <p>Ancalog; oyun, film, dizi, müzik ve anime kayıtlarını tutmaya, puanlamaya, incelemeye ve arkadaşlarla paylaşmaya yarayan ücretsiz bir sitedir.
        Ancalog ticari bir işletme değildir; tek bir kişinin eğlence ve hobi amacıyla, kâr amacı gütmeden ve yapay zekâ araçlarının desteğiyle geliştirdiği bir projedir.
        Site &quot;olduğu gibi&quot; ve &quot;mevcut haliyle&quot; sunulur; kesintisiz ya da hatasız çalışacağı, verilerin hiç kaybolmayacağı, gösterilen bilgilerin
        (oyun bilgileri, süreler, istatistikler, uyum yüzdeleri, sıralamalar, içe aktarılan veriler) doğru ya da eksiksiz olacağı garanti edilmez.
        Önemli kayıtlarını <b>Ayarlar → Verilerimi indir</b> ile ara ara yedeklemeni öneririz. Site değiştirilebilir ya da kapatılabilir;
        kapatılacaksa verilerini indirebilmen için mümkün olduğunca önceden duyurulur.</p>

      <h2>2. Hesap</h2>
      <ul>
        <li>Siteyi kullanmak için en az <b>13 yaşında</b> olmalısın. 18 yaşından küçüksen velinin bilgisi ve onayıyla kullanmalısın.</li>
        <li>Kayıtta verdiğin bilgiler doğru olmalı. Başkası adına ya da başkasını taklit eden hesap açamazsın.</li>
        <li>Hesabının ve şifrenin güvenliğinden sen sorumlusun; şifreni kimseyle paylaşma. Hesabının izinsiz kullanıldığını düşünürsen hemen şifreni değiştir ve yöneticiye haber ver.</li>
        <li>Hesabını istediğin zaman <b>Ayarlar → Hesabımı sil</b> ile kalıcı olarak silebilirsin.</li>
      </ul>

      <h2>3. Topluluk kuralları</h2>
      <p>Aşağıdakileri paylaşmak (inceleme, yorum, mesaj, liste, kullanıcı adı, görünen ad, profil görseli, arka plan, profil şarkısı dahil) yasaktır:</p>
      <ul>
        <li>Hakaret, taciz, tehdit, zorbalık, nefret söylemi ya da ırk, din, cinsiyet, cinsel yönelim gibi özelliklere dayalı ayrımcılık</li>
        <li>Müstehcen, aşırı şiddet içeren ya da reşit olmayanlara uygun olmayan içerikler</li>
        <li>Başkasının kişisel bilgileri (adres, telefon, kimlik bilgisi, özel fotoğraf vb.)</li>
        <li>Telif hakkıyla korunan içeriğin izinsiz paylaşımı ya da korsan içeriğe bağlantı</li>
        <li>Spam, reklam, sahte hesap, oy / beğeni şişirme</li>
        <li>Sitenin işleyişini bozmaya, güvenliğini aşmaya ya da başkalarının hesabına erişmeye yönelik girişimler</li>
        <li>Türkiye Cumhuriyeti kanunlarına aykırı her türlü içerik</li>
      </ul>
      <p>Spoiler içeren incelemelerde spoiler kısmını gizlemen (<b>Spoiler gizle</b> düğmesi) rica olunur.</p>

      <h2>4. Denetim</h2>
      <ul>
        <li>Yöneticiler, kurallara aykırı içerik için kullanıcıya uyarı gönderebilir, içeriği kaldırabilir, profil bilgilerini (görünen ad, yazı, görseller, şarkı) temizleyebilir,
          kullanıcıyı belli bir süre ya da süresiz susturabilir (yorum, forum ve mesaj yazamaz), kullanıcı adı ya da kelime yasaklayabilir ve hesapları kapatabilir.</li>
        <li>Site sahibi, gerekçe göstermek zorunda olmaksızın bir hesabı askıya alma, kapatma ya da hizmeti tamamen durdurma hakkını saklı tutar.</li>
        <li>Hafif ihlallerde önce içerik kaldırılır; ağır ya da tekrarlanan ihlallerde hesap kapatılabilir ve aynı e-postayla tekrar kayıt engellenebilir.</li>
        <li>Bir kararın yanlış olduğunu düşünüyorsan aşağıdaki iletişim yolundan itiraz edebilirsin; itirazın incelenir.</li>
        <li>Kurallara aykırı bir içerik görürsen içeriğin yanındaki <b>Raporla</b> ile bildir; raporlar yalnızca yönetime görünür, raporlayanın kimliği raporlanan kişiyle paylaşılmaz.</li>
        <li>Bir kullanıcıyı engelleyebilirsin: engellenen kişi seni takip edemez, sana mesaj yazamaz ve kayıtlarına yorum yapamaz.</li>
      </ul>

      <h2>5. Paylaştığın içerik ve sorumluluk</h2>
      <p><b>Her kullanıcı, sitede yazdığı ve paylaştığı her şeyden (inceleme, yorum, forum yazısı, mesaj, liste, kullanıcı adı, görsel ve bağlantılar) kişisel olarak ve hukuken sorumludur.</b>
        Ancalog, 5651 sayılı Kanun kapsamında yer sağlayıcı konumundadır; kullanıcıların paylaştığı içerikleri önceden kontrol etmekle yükümlü değildir,
        hukuka aykırı içerikten haberdar edildiğinde içeriği kaldırır.</p>
      <p>Yazdığın incelemelerin, yorumların, listelerin ve notların sahibi sensin. Paylaştığın içeriğin
        Ancalog&apos;da gösterilmesi, başkalarının görmesi ve sitenin çalışması için gereken ölçüde saklanması, kopyalanması ve gösterilmesi için
        ücretsiz, münhasır olmayan bir izin vermiş olursun. Bu izin, içeriği ya da hesabını sildiğinde sona erer.</p>
      <p>Elle eklediğin içerik bilgileri (aramada olmayan bir şarkının adı, sanatçısı, kapağı gibi) ortak katalogda başkaları tarafından da kullanılabilir
        ve yöneticiler tarafından düzeltilebilir.</p>
      <p>Paylaştığın içerik, içe aktardığın veriler ya da siteyi bu koşullara veya kanuna aykırı kullanman nedeniyle üçüncü kişilerin ya da resmi makamların
        site sahibine ve yöneticilerine yönelteceği her türlü talep, şikâyet, dava ve yaptırımdan doğan zarar ve masraflardan, kanunun izin verdiği ölçüde,
        <b> sen sorumlusun</b> ve bunları karşılamayı kabul edersin.</p>

      <h2>5a. Başka sitelerden içe aktarma</h2>
      <ul>
        <li>İçe aktarma (Steam, PlayStation, Xbox, Epic, Nintendo, HowLongToBeat, Backloggd, Playnite, Letterboxd, Simkl, Spotify, Last.fm ve benzerleri)
          tamamen <b>senin isteğinle ve senin adına</b> yapılır. Bu verilerin sana ait olduğunu ya da onları kullanma hakkın olduğunu kabul edersin.</li>
        <li>PlayStation ve Backloggd düğmeleri (yer imleri) <b>senin tarayıcında, senin açtığın sayfada</b> çalışır; ekranda zaten gördüğün listeyi toplar ve
          senin kopyalayıp yapıştırmanı bekler. Ancalog&apos;un sunucusu bu sitelere bağlanmaz, bu sitelere ait şifre ya da oturum bilgin Ancalog&apos;a gelmez.
          Dosyalar (HowLongToBeat, Playnite, Letterboxd, Spotify) senin tarayıcında okunur.</li>
        <li>Bu sitelerin kendi kullanım koşullarına uymak <b>senin sorumluluğundadır</b>. O sitelerin hesabına uygulayabileceği kısıtlama ya da başka sonuçlardan
          Ancalog ve site sahibi sorumlu tutulamaz. Bir sitenin koşullarının buna izin vermediğini düşünüyorsan o yöntemi kullanma; oyun adlarını elle de ekleyebilirsin.</li>
        <li>İçe aktarılan veriler eksik, yanlış eşleşmiş ya da hatalı olabilir; kontrol etmek ve düzeltmek sana aittir.</li>
      </ul>

      <h2>6. Resmi makamlarla iş birliği</h2>
      <p>Mahkemeler, savcılıklar, kolluk kuvvetleri ve diğer yetkili kamu kurum ve kuruluşları tarafından kanuna uygun olarak talep edilmesi halinde;
        hesap bilgileri, paylaşılan içerikler, <b>mesaj kayıtları</b> ve altyapı sağlayıcılarımızın tuttuğu teknik kayıtlar (giriş zamanları, IP adresleri gibi)
        bu makamlarla paylaşılır. Siteyi kullanarak bunu kabul etmiş olursun.</p>

      <h2>7. Telif hakları ve markalar</h2>
      <p>Oyun, film, dizi, albüm ve anime adları, kapak görselleri ve açıklamaları ilgili hak sahiplerine aittir ve yalnızca tanıtım ve bilgi amacıyla gösterilir.
        Bilgiler <a href="https://rawg.io" target="_blank" rel="noopener">RAWG</a>, <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a>,
        {" "}<a href="https://anilist.co" target="_blank" rel="noopener">AniList</a>, Apple Music (iTunes) ve Deezer&apos;dan alınır. Bu site TMDB API&apos;sini kullanır ancak TMDB tarafından onaylanmış değildir.
        Steam&apos;den içe aktarma <a href="https://steamcommunity.com/dev/apiterms" target="_blank" rel="noopener">Steam Web API</a> ile yapılır.
        Profil şarkıları YouTube oynatıcısıyla çalınır; bu kullanımda <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">YouTube Hizmet Şartları</a> geçerlidir.
        Ancalog; RAWG, TMDB, AniList, Apple, Deezer, YouTube, Google, Steam, Valve, Sony Interactive Entertainment (PlayStation), Microsoft (Xbox), OpenXBL,
        Epic Games, Nintendo, HowLongToBeat, Backloggd, Playnite, Letterboxd, Simkl, Spotify ya da Last.fm ile bağlantılı değildir ve bu şirketler tarafından onaylanmaz ya da desteklenmez.
        Adı geçen tüm markalar sahiplerine aittir.</p>
      <p>Hakkını ihlal eden bir içerik gördüysen aşağıdaki iletişim yolundan; içeriğin bağlantısını ve hak sahibi olduğunu gösteren bilgiyi ileterek bildir.
        İncelenir ve haklıysan içerik kaldırılır.</p>

      <h2>8. Sorumluluğun sınırı</h2>
      <p>Ancalog, kullanıcıların paylaştığı içeriklerden, kullanıcılar arasındaki yazışmalardan, içe aktarılan verilerden, üçüncü taraf hizmetlerden
        (veri kaynakları, YouTube, altyapı sağlayıcıları) ve üçüncü taraf sitelere verilen bağlantılardan sorumlu değildir; bu içerikler Ancalog&apos;un görüşünü yansıtmaz.</p>
      <p>Site ücretsiz ve kâr amacı gütmeden sunulduğundan; kullanımından ya da kullanılamamasından, kesintilerden, veri kaybından, hatalı bilgilerden,
        güvenlik olaylarından ya da üçüncü kişilerin davranışlarından doğabilecek doğrudan veya dolaylı hiçbir zarardan (kâr kaybı, veri kaybı, manevi zarar dahil),
        <b> kanunun izin verdiği en geniş ölçüde</b>, site sahibi ve yöneticiler sorumlu tutulamaz ve herhangi bir tazminat yükümlülüğü doğmaz.
        Kanunen sınırlandırılamayan haller (kasıt ve ağır kusur gibi) bu sınırlamanın dışındadır.</p>
      <p>Siteyi kullanmaya devam etmen, bu riskleri bildiğin ve kabul ettiğin anlamına gelir. Kabul etmiyorsan siteyi kullanmayı bırakıp hesabını silebilirsin.</p>

      <h2>9. Değişiklikler ve uygulanacak hukuk</h2>
      <p>Bu koşullar güncellenebilir. Önemli bir değişiklik olursa sitenin üstündeki duyuru alanında haber verilir; değişiklikten sonra siteyi kullanmaya
        devam etmen yeni koşulları kabul ettiğin anlamına gelir. Güncel hali her zaman bu sayfadadır. Koşullar Türkiye Cumhuriyeti kanunlarına tabidir.</p>
      <p>Bu koşulların herhangi bir maddesi geçersiz sayılırsa diğer maddeler geçerliliğini korur. Site sahibinin bir hakkını kullanmaması, o haktan vazgeçtiği anlamına gelmez.</p>

      <h2>10. İletişim</h2>
      <p>Şikâyet, itiraz, telif bildirimi ve sorular için site yöneticisine Ancalog üzerinden ulaşabilirsin: <Link href="/u/arno4436">@arno4436</Link>.</p>

      <p className="muted"><Link href="/privacy">Gizlilik ve KVKK Aydınlatma Metni →</Link></p>
    </article>
  );
}
