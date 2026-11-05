// Backloggd için yer imi düğmesi: kişinin kendi tarayıcısında, Backloggd sayfasındayken çalışır.
// Bütün loglanmış oyunları (Games sayfası, sayfa sayfa) okur: oyunun adresi (IGDB ile aynı, birebir eşleşir), adı, puanı,
// durumu (Played / Playing / Backlog / Wishlist ve Completed, Mastered, Shelved, Abandoned, Retired), beğeni, kapak;
// sonra incelemeleri (Reviews sayfası) toplar. Hiçbir yere veri göndermez; sonuç Ancalog'daki kutuya yapıştırılır.
// Eski düğmeyle toplanan liste (ANCALOG_BACKLOGGD:) de okunmaya devam eder.
export const BL_MARK = "ANCALOG_BACKLOGGD:";
export const BL_MARK2 = "ANCALOG_BACKLOGGD2:";

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
  var say = function (t) { note.textContent = 'Ancalog: ' + t; };
  var failed = 0;
  var get = async function (url) {
    for (var tryNo = 0; tryNo < 5; tryNo++) {
      try {
        var res = await fetch(url, { credentials: 'include' });
        if (res.status === 404) return null;
        if (res.ok) {
          var html = await res.text();
          if (html.indexOf('anubis_challenge') >= 0) { say('Backloggd doğrulama istiyor, bekliyorum…'); await wait(4000); continue; }
          return new DOMParser().parseFromString(html, 'text/html');
        }
      } catch (e) {}
      say('Backloggd yavaşlattı, biraz bekleyip tekrar deniyorum…');
      await wait(3000 * (tryNo + 1));
    }
    failed++;
    return null;
  };
  var games = {}, order = [];
  var slugOf = function (a) { var h = (a && a.getAttribute('href')) || ''; var p = h.split('?')[0].split('/').filter(Boolean); return p[0] === 'games' ? p[1] : ''; };
  var add = function (slug, data) {
    if (!slug) return null;
    var g = games[slug];
    if (!g) { g = games[slug] = { s: slug, t: '', r: 0, st: '', sub: '', l: 0, c: '', rv: '' }; order.push(slug); }
    for (var k in data) if (data[k] && !g[k]) g[k] = data[k];
    return g;
  };
  var cardsOf = function (doc) {
    var cards = doc.querySelectorAll('.col-cus-user-games, .col-cus-5, .rating-hover');
    if (!cards.length) cards = Array.prototype.map.call(doc.querySelectorAll('.game-cover'), function (c) { return c.parentElement || c; });
    return Array.prototype.filter.call(cards, function (c) { return !c.querySelector('.empty-card'); });
  };
  var readCard = function (c, tab) {
    var link = c.querySelector('a.cover-link') || c.querySelector('a[href*="/games/"]');
    var slug = slugOf(link);
    if (!slug) return null;
    var img = c.querySelector('img');
    var name = ((c.querySelector('.game-text-centered') || {}).textContent || (img && img.getAttribute('alt')) || '').trim();
    var rated = c.querySelector('[data-rating]') || (c.hasAttribute && c.hasAttribute('data-rating') ? c : null);
    var rating = rated ? Number(rated.getAttribute('data-rating')) || 0 : 0;
    var log = c.querySelector('[data-log-id], [data-is-play], [data-is-playing], [data-is-backlog], [data-is-wishlist]');
    var st = '', sub = '', liked = 0;
    if (log) {
      st = log.getAttribute('data-is-play') ? 'played' : log.getAttribute('data-is-playing') ? 'playing' : log.getAttribute('data-is-backlog') ? 'backlog' : log.getAttribute('data-is-wishlist') ? 'wishlist' : '';
      sub = (log.getAttribute('data-status-title') || '').toLowerCase();
      liked = log.getAttribute('data-is-liked') && log.getAttribute('data-is-liked') !== 'false' ? 1 : 0;
    }
    var cls = ' ' + (c.className || '') + ' ' + ((c.querySelector('.game-cover') || {}).className || '') + ' ';
    if (!st) st = /fade-played/.test(cls) ? 'played' : /fade-playing/.test(cls) ? 'playing' : /fade-backlog/.test(cls) ? 'backlog' : /fade-wishlist/.test(cls) ? 'wishlist' : (tab || '');
    var src = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';
    return add(slug, { t: name, r: rating, st: st, sub: sub, l: liked, c: /^https:/.test(src) ? src : '' });
  };
  var crawl = async function (base, label, tab) {
    var seenHere = {};
    for (var page = 1; page < 400; page++) {
      say(label + ' ' + page + '. sayfa okunuyor… (' + order.length + ' oyun)');
      var doc = await get(base + (base.indexOf('?') >= 0 ? '&' : '?') + 'page=' + page);
      if (!doc) break;
      var cards = cardsOf(doc), fresh = 0;
      cards.forEach(function (c) { var g = readCard(c, tab); if (g && !seenHere[g.s]) { seenHere[g.s] = 1; fresh++; if (tab && !g.st) g.st = tab; } });
      if (!fresh) break;
      await wait(350);
    }
    return Object.keys(seenHere).length;
  };
  await crawl('/u/' + user + '/games/added/', 'Oyunlar');
  if (!order.length) await crawl('/u/' + user + '/games/', 'Oyunlar');
  var noStatus = order.filter(function (s) { return !games[s].st; }).length;
  if (!order.length || noStatus > order.length / 4) {
    var tabs = ['played', 'playing', 'backlog', 'wishlist'];
    for (var t = 0; t < tabs.length; t++) {
      var n = await crawl('/u/' + user + '/games/added/type:' + tabs[t] + '/', tabs[t], tabs[t]);
      if (!n) await crawl('/u/' + user + '/games/' + tabs[t] + '/', tabs[t], tabs[t]);
    }
  }
  for (var rp = 1; rp < 200; rp++) {
    say('İncelemeler ' + rp + '. sayfa okunuyor…');
    var rdoc = await get('/u/' + user + '/reviews/?page=' + rp);
    if (!rdoc) break;
    var boxes = rdoc.querySelectorAll('.review-card, .user-reviews, .review');
    var got = 0;
    Array.prototype.forEach.call(boxes, function (b) {
      var a = b.querySelector('.game-name a') || b.querySelector('a[href*="/games/"]');
      var slug = slugOf(a);
      var body = b.querySelector('.review-body, .card-text, .review-text, .body-text');
      var text = body ? (body.innerText || body.textContent || '').trim() : '';
      if (!slug || !text) return;
      var spoil = b.querySelector('.spoiler, .has-spoilers, [class*="spoiler"]');
      var g = add(slug, { t: (a.textContent || '').trim() });
      if (!g.rv) { g.rv = (spoil ? '||' + text + '||' : text).slice(0, 5000); got++; }
    });
    if (!got) break;
    await wait(350);
  }
  note.remove();
  if (!order.length) { alert(user + ' kullanıcısında oyun bulunamadı. Kullanıcı adını doğru yazdığından ve profilinin açık olduğundan emin ol.'); return; }
  var list = order.map(function (s) { var g = games[s]; return [g.t || s, g.s, g.st, g.sub, g.r, g.l, g.rv, g.c]; });
  var counts = {}; list.forEach(function (x) { counts[x[2] || 'diğer'] = (counts[x[2] || 'diğer'] || 0) + 1; });
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:24px;z-index:2147483647;background:#111;color:#fff;padding:18px;border-radius:14px;display:flex;flex-direction:column;gap:10px;font:16px sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)';
  var title = document.createElement('b');
  var reviews = list.filter(function (x) { return x[6]; }).length;
  title.textContent = list.length + ' oyun toplandı (' + Object.keys(counts).map(function (k) { return k + ': ' + counts[k]; }).join(', ') + (reviews ? ', ' + reviews + ' inceleme' : '') + ').'
    + (failed ? ' ' + failed + ' sayfa okunamadı; eksik varsa birazdan düğmeye tekrar bas.' : '')
    + ' Aşağıdaki "Kopyala"ya bas, sonra Ancalog\\'daki kutuya yapıştır.';
  var ta = document.createElement('textarea');
  ta.value = '${BL_MARK2}' + JSON.stringify(list);
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
