// PlayStation kütüphanesi için yer imi düğmesi: kişinin kendi tarayıcısında, kendi oturumunda çalışır.
// Sayfaları sırayla gezer (sonsuz kaydırmada en alta iner), görünen yazıları toplar ve kopyalanacak bir kutuda gösterir.
// Hiçbir yere veri göndermez; toplanan yazı Ancalog'daki liste kutusuna yapıştırılır ve orada ayıklanır.
const SCRIPT = `
(async function () {
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var note = document.createElement('div');
  note.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;background:#111;color:#fff;padding:10px 14px;border-radius:10px;font:15px sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.4)';
  document.body.appendChild(note);
  var texts = [], pages = 0;
  for (var i = 0; i < 100; i++) {
    pages++;
    note.textContent = 'Ancalog: ' + pages + '. sayfa toplanıyor…';
    for (var k = 0; k < 4; k++) { window.scrollTo(0, document.body.scrollHeight); await wait(700); }
    var before = document.body.innerText;
    texts.push(before);
    var next = Array.prototype.slice.call(document.querySelectorAll('button, a, [role=button]')).find(function (b) {
      var label = ((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '') + ' ' + (b.textContent || '')).trim();
      return /sonraki|ileri|next/i.test(label) && label.length < 40 && !b.disabled && b.getAttribute('aria-disabled') !== 'true';
    });
    if (!next) break;
    next.click();
    await wait(2500);
    if (document.body.innerText === before) break;
  }
  note.remove();
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:24px;z-index:2147483647;background:#111;color:#fff;padding:18px;border-radius:14px;display:flex;flex-direction:column;gap:10px;font:16px sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)';
  var title = document.createElement('b');
  title.textContent = pages + ' sayfa toplandı. Aşağıdaki "Kopyala"ya bas, sonra Ancalog\\'daki kutuya yapıştır.';
  var ta = document.createElement('textarea');
  ta.value = texts.join('\\n');
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

export const PS_SCRIPT = SCRIPT;
export const psBookmarklet = () => "javascript:" + encodeURIComponent(SCRIPT.replace(/\n\s*/g, " ").trim());
