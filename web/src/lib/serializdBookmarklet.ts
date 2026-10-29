// Serializd için yer imi düğmesi: kişinin kendi tarayıcısında, Serializd'de açtığı sayfada çalışır.
// Sayfayı sonuna kadar kaydırıp (daha fazla yükle düğmelerine de basarak) bütün dizi bağlantılarını toplar.
// Serializd'nin dizi linkleri TMDB numarasını taşır (/show/Supernatural-1622), eşleşme bu yüzden birebir doğrudur.
// Birden çok sayfada basılırsa (İzlediklerim, İzleme listem...) sonuçlar tarayıcıda birikir. Hiçbir yere veri göndermez.
// Not: SCRIPT içinde // yorumu kullanma; yer imine çevrilirken satırlar birleşir.
export const SZ_MARK = "ANCALOG_SERIALIZD:";

const SCRIPT = `
(async function () {
  if (!/serializd\\.com$/.test(location.hostname)) {
    alert('Bu düğmeyi Serializd sitesindeyken kullan. Önce serializd.com\\'da kendi profilini aç, sonra bu yer imine orada bas.');
    if (confirm('Serializd şimdi açılsın mı?')) location.href = 'https://www.serializd.com/';
    return;
  }
  var KEY = 'ancalog_serializd';
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var path = decodeURIComponent(location.pathname + ' ' + document.title).toLowerCase();
  var status = /watchlist|watch-list|want/.test(path) ? 'planned'
    : /dropped|abandon/.test(path) ? 'dropped'
    : /paused|on-hold|hold/.test(path) ? 'paused'
    : /currently|watching(?!list)/.test(path) ? 'active' : 'completed';
  var names = { completed: 'İzlendi', active: 'İzleniyor', planned: 'Planlandı', dropped: 'Bırakıldı', paused: 'Ara verildi' };
  var note = document.createElement('div');
  note.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;background:#111;color:#fff;padding:10px 14px;border-radius:10px;font:15px sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.4)';
  document.body.appendChild(note);
  var found = {};
  var rate = function (card) {
    if (!card) return 0;
    var el = card.querySelector('[aria-label*="star" i],[aria-label*="rating" i],[title*="star" i],[title*="rating" i]');
    var m = el && (el.getAttribute('aria-label') || el.getAttribute('title') || '').match(/(\\d+(?:[.,]\\d+)?)/);
    if (m) { var v = parseFloat(m[1].replace(',', '.')); if (v > 0 && v <= 10) return v <= 5 ? Math.round(v * 4) / 2 : Math.round(v * 2) / 2; }
    var t = (card.textContent || '').match(/(★+)(½)?/);
    return t ? Math.min(10, t[1].length * 2 + (t[2] ? 1 : 0)) : 0;
  };
  var collect = function () {
    document.querySelectorAll('a[href*="/show/"]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var m = href.match(/\\/show\\/([^\\/?#]*?)-(\\d+)(?:[\\/?#]|$)/);
      if (!m || found[m[2]]) return;
      var img = a.querySelector('img');
      var name = ((img && img.getAttribute('alt')) || a.getAttribute('title') || a.textContent || '').trim();
      if (!name || name.length > 150 || /poster|cover/i.test(name)) name = decodeURIComponent(m[1]).replace(/-/g, ' ');
      var card = a.closest('li, article, [class*="card" i], [class*="item" i]');
      found[m[2]] = [name, Number(m[2]), status, rate(card)];
    });
  };
  var clickMore = function () {
    var b = Array.prototype.find.call(document.querySelectorAll('button, a'), function (x) { return /^(load|show|see) more|daha fazla/i.test((x.textContent || '').trim()); });
    if (b) { b.click(); return true; }
    return false;
  };
  var last = -1, still = 0;
  for (var round = 0; round < 400 && still < 4; round++) {
    collect();
    var n = Object.keys(found).length;
    note.textContent = 'Ancalog: sayfa kaydırılıyor, ' + n + ' dizi bulundu…';
    if (n === last) still++; else still = 0;
    last = n;
    clickMore();
    window.scrollTo(0, document.body.scrollHeight);
    await wait(900);
  }
  collect();
  note.remove();
  var here = Object.keys(found).map(function (k) { return found[k]; });
  var all = {};
  try { JSON.parse(localStorage.getItem(KEY) || '[]').forEach(function (r) { all[r[1]] = r; }); } catch (e) {}
  here.forEach(function (r) { var old = all[r[1]]; all[r[1]] = old && !r[3] ? [r[0], r[1], r[2], old[3]] : r; });
  var rows = Object.keys(all).map(function (k) { return all[k]; });
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (e) {}
  if (!here.length && !rows.length) { alert('Bu sayfada dizi bulunamadı. Serializd\\'de profilindeki izlediklerin ya da izleme listen gibi bir sayfayı açıp tekrar bas.'); return; }
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:24px;z-index:2147483647;background:#111;color:#fff;padding:18px;border-radius:14px;display:flex;flex-direction:column;gap:10px;font:16px sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)';
  var title = document.createElement('b');
  title.textContent = 'Bu sayfada ' + here.length + ' dizi bulundu (' + names[status] + ' olarak). Toplam ' + rows.length + ' dizi birikti.'
    + ' Başka sayfaların da varsa (ör. izleme listen) önce oraya geçip düğmeye tekrar bas; hepsi bitince "Kopyala"ya bas ve Ancalog\\'daki kutuya yapıştır.';
  var ta = document.createElement('textarea');
  ta.value = '${SZ_MARK}' + JSON.stringify(rows);
  ta.style.cssText = 'flex:1;width:100%;background:#000;color:#ddd;border-radius:8px;padding:8px';
  var copy = document.createElement('button');
  copy.textContent = 'Kopyala';
  copy.style.cssText = 'padding:14px;font-size:18px;font-weight:700;border-radius:10px;border:0;background:#58a98a;color:#fff;cursor:pointer';
  copy.onclick = async function () {
    ta.select();
    try { await navigator.clipboard.writeText(ta.value); } catch (e) { document.execCommand('copy'); }
    copy.textContent = 'Kopyalandı! Şimdi Ancalog\\'a dön ve yapıştır (Ctrl+V)';
  };
  var reset = document.createElement('button');
  reset.textContent = 'Biriktirileni sıfırla';
  reset.style.cssText = 'padding:10px;border-radius:10px;border:0;cursor:pointer';
  reset.onclick = function () { try { localStorage.removeItem(KEY); } catch (e) {} box.remove(); };
  var close = document.createElement('button');
  close.textContent = 'Kapat';
  close.style.cssText = 'padding:10px;border-radius:10px;border:0;cursor:pointer';
  close.onclick = function () { box.remove(); };
  box.append(title, ta, copy, reset, close);
  document.body.appendChild(box);
})();
`;

export const SZ_SCRIPT = SCRIPT;
export const serializdBookmarklet = () => "javascript:" + encodeURIComponent(SCRIPT.replace(/\n\s*/g, " ").trim());
