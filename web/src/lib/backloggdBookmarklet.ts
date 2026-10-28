// Backloggd için yer imi düğmesi: kişinin kendi tarayıcısında, Backloggd sayfasındayken çalışır.
// Played / Playing / Backlog / Wishlist sekmelerinin bütün sayfalarını sırayla okur (oyun adı ve puan; Games sayfası Played ile aynı liste),
// sonucu kopyalanacak bir kutuda gösterir. Hiçbir yere veri göndermez; yazı Ancalog'daki kutuya yapıştırılır.
export const BL_MARK = "ANCALOG_BACKLOGGD:";

const SCRIPT = `
(async function () {
  if (!/backloggd\\.com$/.test(location.hostname)) {
    alert('Bu düğmeyi Backloggd sitesindeyken kullan. Önce backloggd.com\\'da kendi profilini aç, sonra bu yer imine orada bas.');
    if (confirm('Backloggd şimdi açılsın mı?')) location.href = 'https://backloggd.com/';
    return;
  }
  var m = location.pathname.match(/^\\/u\\/([^\\/]+)/);
  var user = m ? m[1] : prompt('Backloggd kullanıcı adın ne?');
  if (!user) return;
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var note = document.createElement('div');
  note.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;background:#111;color:#fff;padding:10px 14px;border-radius:10px;font:15px sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.4)';
  document.body.appendChild(note);
  var games = [], seen = {}, failed = 0, counts = {};
  var tabs = ['played', 'playing', 'backlog', 'wishlist'];
  var names = { played: 'Played', playing: 'Playing', backlog: 'Backlog', wishlist: 'Wishlist' };
  var get = async function (url) {
    for (var tryNo = 0; tryNo < 5; tryNo++) {
      try {
        var res = await fetch(url, { credentials: 'include' });
        if (res.ok) return new DOMParser().parseFromString(await res.text(), 'text/html');
      } catch (e) {}
      note.textContent = 'Ancalog: Backloggd yavaşlattı, biraz bekleyip tekrar deniyorum…';
      await wait(3000 * (tryNo + 1));
    }
    return null;
  };
  for (var t = 0; t < tabs.length; t++) {
    var tab = tabs[t];
    counts[tab] = 0;
    var miss = 0;
    for (var page = 1; page < 300; page++) {
      note.textContent = 'Ancalog: ' + names[tab] + ' ' + page + '. sayfa okunuyor… (' + games.length + ' oyun)';
      var doc = await get('/u/' + user + '/games/' + (tab ? tab + '/' : '') + '?page=' + page);
      if (!doc) { failed++; if (++miss >= 3) break; continue; }
      miss = 0;
      var cards = doc.querySelectorAll('.game-cover');
      if (!cards.length) break;
      var any = 0;
      cards.forEach(function (c) {
        var img = c.querySelector('img');
        var name = ((img && img.getAttribute('alt')) || (c.querySelector('.game-text-centered') || {}).textContent || '').trim();
        var link = c.querySelector('a.cover-link');
        var slug = (link && link.getAttribute('href')) || name;
        if (!name) return;
        if (!seen[tab + '|' + slug]) { seen[tab + '|' + slug] = 1; any++; }
        if (seen[slug]) return;
        seen[slug] = 1;
        counts[tab]++;
        games.push([name, tab || 'logged', Number(c.getAttribute('data-rating')) || 0]);
      });
      if (!any) break;
      await wait(400);
    }
  }
  note.remove();
  if (!games.length) { alert(user + ' kullanıcısında oyun bulunamadı. Kullanıcı adını doğru yazdığından emin ol.'); return; }
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:24px;z-index:2147483647;background:#111;color:#fff;padding:18px;border-radius:14px;display:flex;flex-direction:column;gap:10px;font:16px sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)';
  var title = document.createElement('b');
  title.textContent = games.length + ' oyun toplandı (' + tabs.filter(function (k) { return counts[k]; }).map(function (k) { return names[k] + ': ' + counts[k]; }).join(', ') + ').'
    + (failed ? ' ' + failed + ' sayfa okunamadı; eksik varsa birazdan düğmeye tekrar bas.' : '')
    + ' Aşağıdaki "Kopyala"ya bas, sonra Ancalog\\'daki kutuya yapıştır.';
  var ta = document.createElement('textarea');
  ta.value = '${BL_MARK}' + JSON.stringify(games);
  ta.style.cssText = 'flex:1;width:100%;background:#000;color:#ddd;border-radius:8px;padding:8px';
  var copy = document.createElement('button');
  copy.textContent = 'Kopyala';
  copy.style.cssText = 'padding:14px;font-size:18px;font-weight:700;border-radius:10px;border:0;background:#58a98a;color:#fff;cursor:pointer';
  copy.onclick = async function () {
    ta.select();
    try { await navigator.clipboard.writeText(ta.value); } catch (e) { document.execCommand('copy'); }
    copy.textContent = 'Kopyalandı! Şimdi Ancalog\\'a dön ve yapıştır (Ctrl+V)';
  };
  var close = document.createElement('button');
  close.textContent = 'Kapat';
  close.style.cssText = 'padding:10px;border-radius:10px;border:0;cursor:pointer';
  close.onclick = function () { box.remove(); };
  box.append(title, ta, copy, close);
  document.body.appendChild(box);
})();
`;

export const BL_SCRIPT = SCRIPT;
export const backloggdBookmarklet = () => "javascript:" + encodeURIComponent(SCRIPT.replace(/\n\s*/g, " ").trim());
