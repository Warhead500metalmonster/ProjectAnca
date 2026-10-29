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
          <li>Oyun, film, dizi, albüm ve anime bilgileri ile kapakları hak sahiplerine ait; biz sadece gösteriyoruz. Hakkını ihlal eden bir içerik görürsen bildir, kaldırırız.</li>
          <li>Kurala uymayanı raporla, rahatsız edeni engelle; her raporu bir insan okur.</li>
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
        <li>Raporlamayı ya da engellemeyi kötüye kullanmak (bilerek asılsız rapor göndermek, birini taciz etmek için yeni hesaplar açmak gibi)</li>
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
        <li>İçe aktarma (Steam, PlayStation, Xbox, Epic, Nintendo, HowLongToBeat, Backloggd, Playnite, Letterboxd, MyAnimeList, AniList, Simkl, Spotify, Last.fm ve benzerleri)
          tamamen <b>senin isteğinle ve senin adına</b> yapılır. Bu verilerin sana ait olduğunu ya da onları kullanma hakkın olduğunu kabul edersin.</li>
        <li>PlayStation ve Backloggd düğmeleri (yer imleri) <b>senin tarayıcında, senin açtığın sayfada</b> çalışır; ekranda zaten gördüğün listeyi toplar ve
          senin kopyalayıp yapıştırmanı bekler. Ancalog&apos;un sunucusu bu sitelere bağlanmaz, bu sitelere ait şifre ya da oturum bilgin Ancalog&apos;a gelmez.
          Dosyalar (HowLongToBeat, Playnite, Letterboxd, MyAnimeList, Spotify) senin tarayıcında okunur.</li>
        <li>Bu sitelerin kendi kullanım koşullarına uymak <b>senin sorumluluğundadır</b>. O sitelerin hesabına uygulayabileceği kısıtlama ya da başka sonuçlardan
          Ancalog ve site sahibi sorumlu tutulamaz. Bir sitenin koşullarının buna izin vermediğini düşünüyorsan o yöntemi kullanma; oyun adlarını elle de ekleyebilirsin.</li>
        <li>İçe aktarılan veriler eksik, yanlış eşleşmiş ya da hatalı olabilir; kontrol etmek ve düzeltmek sana aittir.</li>
      </ul>

      <h2>6. Resmi makamlarla iş birliği</h2>
      <p>Mahkemeler, savcılıklar, kolluk kuvvetleri ve diğer yetkili kamu kurum ve kuruluşları tarafından kanuna uygun olarak talep edilmesi halinde;
        hesap bilgileri, paylaşılan içerikler, <b>mesaj kayıtları</b> ve altyapı sağlayıcılarımızın tuttuğu teknik kayıtlar (giriş zamanları, IP adresleri gibi)
        bu makamlarla paylaşılır. Siteyi kullanarak bunu kabul etmiş olursun.</p>

      <h2>7. Fikri mülkiyet</h2>
      <h3>Üçüncü kişilere ait içerik ve markalar</h3>
      <p>Oyun, film, dizi, albüm ve anime adları, kapak görselleri, ekran görüntüleri, logolar ve açıklamalar ilgili hak sahiplerine aittir;
        Ancalog&apos;da yalnızca tanıtım, bilgi ve kişisel arşiv amacıyla, kaynağı belirtilerek gösterilir. Bu içerikler üzerinde Ancalog herhangi bir hak iddia etmez.</p>
      <p>Bilgiler <a href="https://rawg.io" target="_blank" rel="noopener">RAWG</a>, <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a>,
        {" "}<a href="https://anilist.co" target="_blank" rel="noopener">AniList</a>, Apple Music (iTunes) ve Deezer&apos;dan, bu servislerin kendi kullanım koşullarına uygun olarak alınır.
        Bu site TMDB API&apos;sini kullanır ancak TMDB tarafından onaylanmış değildir. Steam&apos;den içe aktarma <a href="https://steamcommunity.com/dev/apiterms" target="_blank" rel="noopener">Steam Web API</a> ile yapılır.
        Profil şarkıları sitede barındırılmaz, YouTube&apos;un kendi oynatıcısıyla çalınır; bu kullanımda <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">YouTube Hizmet Şartları</a> geçerlidir.</p>
      <p>Ancalog; RAWG, TMDB, AniList, MyAnimeList, Apple, Deezer, YouTube, Google, Steam, Valve, Sony Interactive Entertainment (PlayStation), Microsoft (Xbox), OpenXBL,
        Epic Games, Nintendo, HowLongToBeat, Backloggd, Playnite, Letterboxd, Simkl, Spotify ya da Last.fm ile bağlantılı değildir ve bu şirketler tarafından onaylanmaz, desteklenmez
        ya da sponsor edilmez. Adı geçen tüm markalar ve ticari adlar sahiplerine aittir; yalnızca ilgili hizmeti tanımlamak için anılır.</p>

      <h3>Ancalog&apos;a ait olanlar</h3>
      <p>&quot;Ancalog&quot; adı, logosu, sitenin özgün tasarımı, metinleri ve yazılımı site sahibine aittir. Kişisel ve ticari olmayan kullanım dışında izinsiz kopyalanamaz,
        çoğaltılamaz ya da başka bir hizmette Ancalog&apos;muş gibi kullanılamaz.</p>

      <h3>Senin paylaştıkların</h3>
      <ul>
        <li>Yazdığın incelemelerin, yorumların ve listelerin sahibi sensin (ayrıntılar 5. maddede).</li>
        <li>Profil fotoğrafı, kapak, arka plan, profil şarkısı ve paylaştığın bağlantılar için <b>kullanma hakkın olduğunu</b> kabul edersin.
          Başkasına ait fotoğrafı, çizimi ya da içeriği izinsiz kullanmak yasaktır.</li>
        <li>İncelemelerde eleştiri ve tanıtım amacıyla, kaynağını belirterek kısa alıntı yapabilirsin (5846 sayılı FSEK md. 35); bir eserin tamamını ya da büyük bir kısmını kopyalamak,
          korsan içeriğe bağlantı vermek yasaktır.</li>
      </ul>

      <h3>Hak ihlali bildirimi ve içerik kaldırma</h3>
      <p>Ancalog&apos;da bir içeriğin telif, marka ya da başka bir fikri hakkını ihlal ettiğini düşünüyorsan, 5846 sayılı Kanun ve 5651 sayılı Kanun kapsamında bize bildirebilirsin.
        Bildirimin şunları içermesi incelemeyi hızlandırır:</p>
      <ol>
        <li>Adın ve sana ulaşabileceğimiz bir iletişim yolu,</li>
        <li>Hakkı ihlal edildiğini düşündüğün eser ya da marka,</li>
        <li>Ancalog&apos;daki içeriğin bağlantısı (sayfa adresi),</li>
        <li>Hak sahibi ya da hak sahibi adına yetkili olduğunu gösteren kısa bir açıklama.</li>
      </ol>
      <p>Bildirimi içeriğin yanındaki <b>Raporla</b> düğmesiyle (sebep: Diğer) ya da 10. maddedeki iletişim yolundan gönderebilirsin. Haklı bulunan içerik makul sürede kaldırılır
        ve paylaşan kullanıcıya bildirilir. İçeriği kaldırılan kullanıcı, hakkı olduğunu düşünüyorsa aynı yoldan itiraz edebilir. Hakları tekrar tekrar ihlal eden hesaplar kapatılabilir.</p>

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
      <p>Şikâyet, itiraz, telif bildirimi ve sorular için kurucuya Ancalog üzerinden ulaşabilirsin: <Link href="/chat/arno4436">@arno4436</Link> (takipleşmeniz gerekmez,
        susturulmuş olsan da yazabilirsin). Site dışından: Discord <b>arno4436</b>. İçeriklerle ilgili bildirimler için içeriğin yanındaki <b>Raporla</b> düğmesi en hızlı yoldur.</p>

      <h2>11. Sık sorulan sorular</h2>
      <p className="muted">Hukuk dilini bir kenara bırakalım; en çok merak edilenler, düz Türkçeyle:</p>
      <details className="help-q"><summary>Ancalog bir şirket mi, para kazanıyor mu?</summary>
        <p>Hayır. Tek bir kişinin hobi olarak, kâr amacı gütmeden yaptığı ücretsiz bir site. Reklam yok, ücretli üyelik yok, &quot;premium&quot; yok, veri satışı yok.</p></details>
      <details className="help-q"><summary>Verilerim satılıyor ya da reklam için kullanılıyor mu?</summary>
        <p>Hayır. Verilerin sadece sitenin çalışması için kullanılır; satılmaz, kiralanmaz, reklam ya da profilleme için kullanılmaz. Ayrıntılar <Link href="/privacy">Gizlilik</Link> sayfasında.</p></details>
      <details className="help-q"><summary>Verilerimi alıp gidebilir miyim? Hesabımı silersem ne olur?</summary>
        <p>Evet, istediğin an. <b>Ayarlar → Verilerimi indir</b> ile her şeyini Excel / CSV, JSON ya da Letterboxd biçiminde indirirsin. <b>Hesabımı sil</b> dediğinde profilin,
          kayıtların, listelerin, yorumların, mesajların ve takiplerin hemen ve kalıcı olarak silinir; geri getirilemez. Soru sorulmaz, gönül koyulmaz.</p></details>
      <details className="help-q"><summary>Profilimi gizlersem başkaları ne görür?</summary>
        <p>Adını, fotoğrafını, kapağını, arka planını, rozetlerini, kaçıncı üye olduğunu ve profil şarkını görürler. Kütüphanen, listelerin, istatistiklerin ve hareketlerin görünmez;
          sıralamalara ve uyum hesaplarına da girmez. &quot;Sadece arkadaşlar&quot; seçersen karşılıklı takipleştiğin kişiler her şeyi görür.</p></details>
      <details className="help-q"><summary>Biri beni engellerse ya da ben birini engellersem karşı taraf anlar mı?</summary>
        <p>Kimseye bildirim gitmez. Ama engellenen kişi seni takip etmeye, sana yazmaya ya da kayıtlarına yorum yapmaya çalışırsa bunun mümkün olmadığını görür.
          Engeli istediğin zaman kaldırabilirsin; aranızdaki eski takipler kendiliğinden geri gelmez.</p></details>
      <details className="help-q"><summary>Birini raporlarsam benim raporladığımı öğrenir mi?</summary>
        <p>Hayır. Raporu sadece yönetim görür; raporlanan kişiye kimin raporladığı söylenmez. Lütfen sadece gerçekten kurala aykırı şeyleri raporla; asılsız raporları tekrar tekrar göndermek de kural ihlalidir.</p></details>
      <details className="help-q"><summary>Ben raporlanırsam ne olur? Otomatik ceza var mı?</summary>
        <p>Otomatik ceza yok; her raporu bir insan okur. Çoğu rapor &quot;bir şey yapma&quot; ile kapanır. Kural ihlali varsa duruma göre önce uyarı gelir (siteye girince üstte görürsün),
          gerekirse içerik silinir, tekrarlanırsa susturma, çok ağır durumlarda hesap kapatma olur. Haksızlık olduğunu düşünürsen itiraz edebilirsin.</p></details>
      <details className="help-q"><summary>Susturuldum ya da hesabım kapatıldı, ne yapabilirim?</summary>
        <p>Susturulduğunda yorum, forum yazısı ve mesaj yazamazsın ama kütüphanen yerinde durur, loglamaya devam edebilirsin. Susturulmuş olsan da kurucuya (<Link href="/u/arno4436">@arno4436</Link>) yazabilir,
          itiraz edebilirsin. Hesabın kapatıldıysa Discord&apos;dan (<b>arno4436</b>) ulaşabilirsin.</p></details>
      <details className="help-q"><summary>Mesajlarımı yöneticiler okuyor mu?</summary>
        <p>Hayır, mesajlar sadece sen ve karşındaki kişi içindir. İki istisna var: bir mesajlaşma raporlanırsa, raporlanan kişinin son birkaç mesajı rapora eklenir ve yönetim onu görür;
          ya da mahkeme, savcılık gibi yetkili bir makam kanuna uygun olarak isterse. Mesajlar uçtan uca şifreli değildir; çok özel şeyleri buraya yazma.</p></details>
      <details className="help-q"><summary>Steam, PlayStation, Backloggd gibi yerlerden içe aktarmak yasal mı? Hesabım banlanır mı?</summary>
        <p>İçe aktarma tamamen senin isteğinle, senin kendi verin için yapılır ve hiçbir sitenin şifresi istenmez. Steam&apos;in resmi API&apos;si kullanılır; PlayStation ve Backloggd düğmeleri
          senin tarayıcında, zaten ekranda gördüğün listeyi toplar. Yine de o sitelerin kendi kurallarına uymak senin sorumluluğunda; içine sinmezse o yöntemi kullanma, oyunları elle de ekleyebilirsin.</p></details>
      <details className="help-q"><summary>Kapaklar, oyun görselleri ve açıklamalar telif ihlali değil mi?</summary>
        <p>Bunlar hak sahiplerine aittir; Ancalog bunları RAWG, TMDB, AniList, Apple ve Deezer gibi servislerin izin verdiği şekilde, kaynağını belirterek, sadece tanıtım ve kişisel arşiv amacıyla gösterir
          ve üzerlerinde hak iddia etmez. Hakkını ihlal eden bir şey görürsen 7. maddedeki yolla bildir, kaldırırız.</p></details>
      <details className="help-q"><summary>İncelememde spoiler, küfür ya da sert eleştiri olabilir mi?</summary>
        <p>Sert eleştiri serbest: bir oyunu, filmi, albümü istediğin kadar beğenmeyebilirsin. Spoiler yazacaksan <b>Spoiler gizle</b> ile gizle. Küfür kişilere yönelikse, hakaret ya da nefret söylemi içeriyorsa yasak.</p></details>
      <details className="help-q"><summary>Profil fotoğrafı, arka plan ya da şarkı olarak her şeyi koyabilir miyim?</summary>
        <p>Kullanma hakkın olan, müstehcen ya da şiddet içermeyen, başkasını taklit etmeyen her şeyi. Profil şarkıları YouTube&apos;un kendi oynatıcısıyla çalar, sitede barındırılmaz;
          YouTube&apos;dan kaldırılan bir şarkı burada da çalmaz.</p></details>
      <details className="help-q"><summary>Kaç yaşında olmam gerekiyor?</summary>
        <p>En az 13. 18 yaşından küçüksen velinin bilgisi ve onayıyla kullanmalısın.</p></details>
      <details className="help-q"><summary>Polis ya da mahkeme bilgilerimi isterse ne olur?</summary>
        <p>Yetkili bir makam kanuna uygun olarak isterse hesap bilgilerin, paylaştıkların, mesajların ve altyapı sağlayıcılarının tuttuğu teknik kayıtlar (giriş zamanı, IP adresi gibi) onlarla paylaşılır.
          Bu, her sitenin uymak zorunda olduğu bir kural. Ancalog kendi isteğiyle kimseye veri vermez.</p></details>
      <details className="help-q"><summary>Site kapanırsa ya da bir şey bozulursa verilerim ne olur?</summary>
        <p>Site kapanacaksa verilerini indirebilmen için mümkün olduğunca önceden duyurulur. Hobi projesi olduğu için hiçbir şey garanti edilemez; önemli kayıtlarını ara ara <b>Verilerimi indir</b> ile yedeklemeni öneririz.</p></details>
      <details className="help-q"><summary>Yöneticiler kim, neyi yapabilir?</summary>
        <p>Kurucu ve onun atadığı yöneticiler. Hepsi aynı yetkiye sahiptir: raporları inceler, uyarı gönderir, içerik siler, susturur, gerekirse hesap kapatır, duyuru yazar.
          E-posta adresini ve şifreni kimse göremez. Yöneticiler kurucuya işlem yapamaz.</p></details>
      <details className="help-q"><summary>Kurallar değişirse nereden öğrenirim?</summary>
        <p>Önemli değişiklikler <Link href="/community">Topluluk → Duyurular</Link>&apos;da ve sitenin üstündeki duyuru alanında yazılır. Bu sayfanın en üstünde son güncelleme tarihi var.</p></details>
      <details className="help-q"><summary>Sorumun cevabı burada yok.</summary>
        <p><Link href="/chat/arno4436">Kurucuya yaz</Link>; takipleşmenize gerek yok. Cevabı sık sorulan bir şeyse buraya da eklenir.</p></details>

      <p className="muted"><Link href="/privacy">Gizlilik ve KVKK Aydınlatma Metni →</Link></p>
    </article>
  );
}
