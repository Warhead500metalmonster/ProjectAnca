import Link from "next/link";

export const metadata = { title: "Biz kimiz? · Ancalog" };

export default function AboutPage() {
  return (
    <div className="legal about">
      <h1>Biz kimiz?</h1>
      <p className="muted">Aslında &quot;biz&quot; değil, &quot;ben&quot;.</p>

      <h2>Merhaba, ben Anıl</h2>
      <p>
        Sitede <Link className="grad" href="/u/arno4436">@arno4436</Link> olarak bulabilirsin. Ancalog&apos;u tek başıma, hobi olarak yapıyorum:
        tasarımı, kodu, veritabanı ve sunucu tarafı, yasal metinler, hepsi benim elimden çıkıyor. Bu yüzden bir şey bozulursa da,
        güzel bir şey eklenirse de muhatabın doğrudan benim.
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
        <li>Kayıtların senindir. İstediğin an <Link className="grad" href="/settings">Ayarlar</Link>&apos;dan Excel, JSON ya da Letterboxd biçiminde indirebilir, hesabını tamamen silebilirsin.</li>
        <li>Reklam yok, veri satışı yok, takip çerezi yok. Ayrıntılar <Link className="grad" href="/privacy">Gizlilik ve KVKK</Link> sayfasında.</li>
        <li>Önerilerini okurum. Sitedeki pek çok özellik kullanıcıların isteğiyle eklendi.</li>
      </ul>

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
