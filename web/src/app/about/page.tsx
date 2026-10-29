import Link from "next/link";

export const metadata = { title: "Biz kimiz? · Ancalog" };

export default function AboutPage() {
  return (
    <div className="legal about">
      <h1>Biz kimiz?</h1>
      <p className="muted">Küçük bir ekibiz: ben ve arkadaşım Wulfa.</p>

      <h2>Merhaba, ben Anıl</h2>
      <p>
        Sitede <Link className="grad" href="/u/arno4436">@arno4436</Link> olarak bulabilirsin. Ancalog&apos;u hobi olarak yapıyorum ve sitenin sahibiyim:
        kodun, veritabanının ve sunucu tarafının büyük kısmı, yasal metinler ve kullanıcı istekleri benden geçiyor. Bu yüzden bir şey bozulursa da,
        güzel bir şey eklenirse de muhatabın doğrudan benim.
      </p>

      <h2>Wulfa</h2>
      <p>
        <Link className="grad" href="/u/wulfa">@wulfa</Link> sitenin geliştirilmesinde benimle birlikte çalışan arkadaşım. Ancalog&apos;un bugünkü
        sürümünü ilk o başlattı; ana sayfanın kendi kapaklarınla kayan üst kısmı, profil ve oyun sayfalarının tasarımı, gruplanmış akış ve sitenin
        sade, emojisiz görünümü onun elinden çıktı.
      </p>

      <p className="about-note">
        Ancalog tamamen kâr amacı gütmeyen bir hobi projesidir. Eğlence için, yapay zekâ desteğiyle geliştiriliyor;
        reklam almıyor, para kazanmıyor ve kimseye ücret ödetmiyor.
      </p>

      <h2>Ancalog neden var?</h2>
      <p>
        Oynadığım oyunları, izlediğim film ve dizileri, dinlediğim albümleri yıllardır farklı yerlerde tutuyordum. Her biri ayrı bir site,
        çoğu da kafa karıştıran menülerle dolu. Hepsini tek bir yerde, sade ve anlaşılır biçimde tutabileceğim, arkadaşlarımın ne oynayıp
        ne izlediğini görebileceğim bir yer istedim. Bulamayınca kendim yaptım.
      </p>
      <p>
        Benim için en önemli kural şu: site kullanımı kolay olsun. Yeni bir özellik eklerken önce &quot;bu işi zorlaştırır mı?&quot; diye bakıyorum.
      </p>

      <h2>Ben kimim?</h2>
      <ul>
        <li>Oyun koleksiyoncusuyum; Steam kütüphanem yüzlerce oyunu geçti. Souls tarzı oyunlar, dövüş oyunları ve eski usul zindan oyunları favorilerim.</li>
        <li>Metal ve progresif rock dinlerim. Profilimde çalan Pink Floyd şarkısı tesadüf değil.</li>
        <li>Hobi olarak kod yazıyorum: Godot ile <b>Mystic Abyss II</b> adında gerçek zamanlı bir 3D zindan oyunu, Discord için sesli okuma botu
          ve arkadaşlarım için modlu bir Project Zomboid sunucusu da benim işlerim.</li>
      </ul>

      <h2>Sözüm</h2>
      <ul>
        <li><b>Seni burada tutmaya çalışmam.</b> Kayıtların senindir: puanların, sürelerin, incelemelerin, listelerin. İstediğin gün{" "}
          <Link className="grad" href="/settings">Ayarlar</Link>&apos;dan hepsini tek tıkla Excel, JSON ya da Letterboxd biçiminde indirip başka yere taşıyabilirsin. Soru sorulmaz, gönül koyulmaz.</li>
        <li><b>Gidersen iz kalmaz.</b> Hesabını sildiğinde kayıtların, yorumların ve mesajların da silinir.</li>
        <li><b>Gelmek de gitmek kadar kolay.</b> Başka sitelerdeki geçmişini <Link className="grad" href="/import">İçe aktar</Link>&apos;dan birkaç dakikada getirirsin; sıfırdan başlamazsın.</li>
        <li><b>Ücretsiz.</b> Reklam yok, veri satışı yok, takip çerezi yok, &quot;premium&quot; yok. Ayrıntılar <Link className="grad" href="/privacy">Gizlilik ve KVKK</Link> sayfasında.</li>
        <li><b>Önerilerini okurum.</b> Sitedeki pek çok özellik kullanıcıların isteğiyle eklendi.</li>
      </ul>

      <h2>Nasıl kullanılır? (kısaca)</h2>
      <ul>
        <li><b>Ekle:</b> sağ üstteki <b>+ Ekle</b> ile oyun, film, dizi, albüm ya da anime ara; durumunu, puanını ve süresini seç, kaydet. Hepsi bu.</li>
        <li><b>Getir:</b> Steam, PlayStation, Backloggd, Letterboxd, MyAnimeList ve daha fazlasındaki geçmişini <Link className="grad" href="/import">İçe aktar</Link>&apos;dan topluca getir.</li>
        <li><b>Takip et:</b> arkadaşlarını <Link className="grad" href="/community">Topluluk</Link>&apos;tan bul; ne oynadıkları ana sayfana düşer, zevkinizin ne kadar uyuştuğunu görürsün.</li>
        <li><b>Süsle:</b> profil fotoğrafı, kapak, tema rengi, arka plan ve profil şarkısı <Link className="grad" href="/settings">Ayarlar</Link>&apos;da.</li>
        <li>Takıldığın yer olursa <Link className="grad" href="/help">kullanım rehberine</Link> bak ya da bana yaz.</li>
      </ul>

      <h2>Yasaklar (kısaca)</h2>
      <p className="muted">Burası arkadaş ortamı. Tartışmak, eleştirmek, bir oyunu yerden yere vurmak serbest; şunlar değil:</p>
      <ul>
        <li><b>Hakaret, taciz, tehdit, nefret söylemi.</b> Fikre değil kişiye saldırmak yok.</li>
        <li><b>Habersiz spoiler.</b> Sürpriz bozacaksan yazarken <b>Spoiler gizle</b>&apos;ye bas, ya da ||böyle|| yaz.</li>
        <li><b>Spam ve reklam.</b> Aynı şeyi tekrar tekrar yazmak, link yağdırmak, sahte hesap açmak yok.</li>
        <li><b>Başkası gibi davranmak.</b> Başkasının adıyla, fotoğrafıyla hesap açmak yok.</li>
        <li><b>Kişisel bilgi.</b> Kimsenin adresini, telefonunu, özel fotoğrafını paylaşmak yok.</li>
        <li><b>Yasa dışı ve +18 içerik.</b> Korsan link, müstehcen görsel, yasa dışı her şey yok.</li>
      </ul>

      <h2>Rahatsız olursan</h2>
      <ul>
        <li><b>Engelle:</b> birinin profilindeki <b>⋯</b> düğmesinden. Seni takip edemez, sana yazamaz, kayıtlarına yorum yapamaz; sen de onu görmezsin. Kimseye haber gitmez.</li>
        <li><b>Raporla:</b> profillerde ⋯ düğmesinde; kayıtlarda, yorumlarda, listelerde, forum yazılarında ve mesajlarda küçük <b>Raporla</b> yazısı var.
          Raporun sadece yönetime gider, <b>kimin raporladığını kimse bilmez</b>.</li>
        <li><b>Gizle:</b> profilini <Link className="grad" href="/settings">Ayarlar</Link>&apos;dan sadece arkadaşlarına ya da sadece kendine açabilirsin.</li>
      </ul>

      <h2>Kural çiğnenirse ne olur?</h2>
      <p className="muted">Her raporu bir insan okur, otomatik ceza yoktur. Duruma göre:</p>
      <ul>
        <li><b>Uyarı:</b> siteye girince en üstte yönetimden kısa bir not görürsün. Çoğu zaman iş burada biter.</li>
        <li><b>İçeriğin kaldırılması:</b> kurala uymayan yazı, yorum, liste ya da profil bilgisi silinir.</li>
        <li><b>Susturma:</b> bir süre (ağır durumlarda süresiz) yorum, forum yazısı ve mesaj yazamazsın. Kütüphanen yerinde durur, loglamaya devam edebilirsin.</li>
        <li><b>Hesap kapatma:</b> sadece ağır ya da tekrarlanan durumlarda.</li>
      </ul>
      <p className="muted">Bir kararın haksız olduğunu düşünüyorsan <Link className="grad" href="/chat/arno4436">bana yaz</Link>, mutlaka bakarım. Susturulmuş olsan da bana yazabilirsin.
        Hukuki ayrıntılar <Link className="grad" href="/terms">Kullanım Koşulları</Link>&apos;nda.</p>

      <h2>Bana ulaş</h2>
      <ul>
        <li>Site içinden: <Link className="grad" href="/chat/arno4436">bana mesaj at</Link>. Takipleşmemize gerek yok; soru, sorun, şikayet ya da öneri, ne olursa yaz.</li>
        <li>Discord: <b>arno4436</b></li>
        <li>itch.io: <a className="grad" href="https://arno4436.itch.io/" target="_blank" rel="noopener">arno4436.itch.io</a></li>
        <li>Kaynak kod: <a className="grad" href="https://github.com/Warhead500metalmonster/ProjectAnca" target="_blank" rel="noopener">GitHub</a></li>
      </ul>
    </div>
  );
}
