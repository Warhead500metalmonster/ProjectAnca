// Ancalog: oyun, film, dizi, müzik ve anime günlüğü + topluluk.
// Veriler Supabase'de, oyun bilgileri RAWG'den. Ayarlar config.js'te.

const WATCH = ["Netflix", "Disney+", "Prime Video", "HBO Max", "Apple TV+", "YouTube", "Mubi", "Tabii", "Exxen", "Sinema", "TV"];
const TYPES = {
  game:  { label: "Oyun",  icon: "🎮", creator: "Geliştirici",      active: "Oynuyorum",  done: "bitirdi", doing: "oynuyor",
           where: "Platform", progress: "ör. Ana hikâye %60, 5. bölüm",
           places: ["PC", "PlayStation 5", "PlayStation 4", "Xbox Series X|S", "Xbox One", "Nintendo Switch", "Nintendo Switch 2", "Steam Deck", "iOS", "Android"] },
  movie: { label: "Film",  icon: "🎬", creator: "Yönetmen",         active: "İzliyorum",  done: "izledi",  doing: "izliyor",
           where: "Nerede izledin", progress: "ör. 1 saat 10 dakikada kaldım", places: WATCH },
  show:  { label: "Dizi",  icon: "📺", creator: "Yaratıcı / Kanal", active: "İzliyorum",  done: "bitirdi", doing: "izliyor",
           where: "Nerede izledin", progress: "ör. 2. sezon 5. bölüm", places: WATCH },
  music: { label: "Müzik", icon: "🎵", creator: "Sanatçı",          active: "Dinliyorum", done: "dinledi", doing: "dinliyor", square: true,
           where: "Nerede dinledin", progress: "ör. 7. şarkı", places: ["Spotify", "Apple Music", "YouTube Music", "Deezer", "Plak", "CD", "Konser"] },
  anime: { label: "Anime", icon: "🌸", creator: "Stüdyo",           active: "İzliyorum",  done: "bitirdi", doing: "izliyor",
           where: "Nerede izledin", progress: "ör. 12. bölüm", places: ["Crunchyroll", "Netflix", "Prime Video", "Disney+", "YouTube"] },
};
const STORES = ["Steam", "Epic Games Store", "PlayStation Store", "Xbox Store", "Xbox Game Pass", "PC Game Pass", "Nintendo eShop", "GOG",
  "EA app", "Ubisoft Connect", "Battle.net", "itch.io", "App Store", "Google Play", "Fiziksel kopya"];

const STATUSES = ["completed", "active", "planned", "paused", "dropped"];
const statusLabel = (s, type) => ({
  completed: "Bitti",
  active: type ? TYPES[type].active : "Devam ediyor",
  planned: "Planlandı",
  paused: "Ara verdim",
  dropped: "Bıraktım",
})[s];
const activityVerb = (e) => ({
  completed: TYPES[e.type].done,
  active: TYPES[e.type].doing,
  planned: "listesine ekledi",
  paused: "ara verdi",
  dropped: "bıraktı",
})[e.status];

const LOCAL_KEY = "ancalog.v1"; // hesaplardan önceki, tarayıcıda tutulan kayıtlar
const ENTRY_COLS = "*, profiles(username, display_name, avatar_url)";

const sb = SUPABASE_URL ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (id) => document.getElementById(id);

const state = { user: null, me: null, following: new Set() };
const cache = new Map();  // id → kayıt (tıklamada açmak için)
let current = null;       // açık profil sayfası: { profile, entries, isMe }
let lib = {};             // profil kütüphanesi filtreleri
let currentGame = null;   // açık oyun sayfasının RAWG verisi

// ---------- Yardımcılar ----------

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");
// style="..." içine güvenle konabilen url(); tırnak ve parantezler kodlanır
const cssUrl = (u) => `url('${u.replace(/["'()\\\s<>&]/g, (c) => "%" + c.charCodeAt(0).toString(16))}')`;

function today() {
  const d = new Date();
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
const fmtDate = (d) => new Date(d + "T00:00").toLocaleDateString("tr", { day: "numeric", month: "long", year: "numeric" });
const fmtHours = (h) => `${Number(h).toLocaleString("tr", { maximumFractionDigits: 1 })} saat`;
const fmtRating = (r) => (r / 2).toLocaleString("tr");
// RAWG görselini genişliğe göre küçült (dikey kapak CSS ile kırpılır)
const resized = (url, w = 640) => url.replace(/\/media\/(games|screenshots)\//, `/media/resize/${w}/-/$1/`);

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return "az önce";
  const units = [[60, "dakika"], [3600, "saat"], [86400, "gün"], [604800, "hafta"], [2592000, "ay"], [31536000, "yıl"]];
  let i = units.length - 1;
  while (i > 0 && s < units[i][0]) i--;
  return `${Math.floor(s / units[i][0])} ${units[i][1]} önce`;
}

function starsHtml(r) {
  let out = "";
  for (let i = 1; i <= 5; i++) {
    const v = r - (i - 1) * 2;
    out += `<span class="star ${v >= 2 ? "full" : v === 1 ? "half" : ""}" data-i="${i}">★</span>`;
  }
  return out;
}

function avatarHtml(p, cls = "") {
  const url = safeUrl(p?.avatar_url);
  if (url) return `<img class="avatar ${cls}" src="${esc(url)}" alt="">`;
  const name = p?.display_name || p?.username || "?";
  let h = 0;
  for (const c of p?.username || "") h = (h * 31 + c.charCodeAt(0)) % 360;
  return `<span class="avatar ${cls}" style="background:linear-gradient(135deg,hsl(${h} 70% 55%),hsl(${(h + 50) % 360} 70% 40%))">${esc([...name][0].toLocaleUpperCase("tr"))}</span>`;
}
const displayName = (p) => esc(p?.display_name || p?.username || "?");

let toastTimer;
function toast(msg) {
  $("toast").textContent = msg;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 2600);
}

// Supabase cevabını aç: hata varsa fırlat
async function q(req) {
  const { data, error } = await req;
  if (error) throw error;
  return data;
}
async function countOf(req) {
  const { count, error } = await req;
  if (error) throw error;
  return count || 0;
}
const remember = (list) => (list.forEach((e) => cache.set(e.id, e)), list);

function fetchFeed({ users, limit = 20 } = {}) {
  let req = sb.from("entries").select(ENTRY_COLS).order("updated_at", { ascending: false }).limit(limit);
  if (users) req = req.in("user_id", users);
  return q(req).then(remember);
}
const fetchEntries = (userId) =>
  q(sb.from("entries").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(2000));

// ---------- Ortak parçalar ----------

function statsHtml(list) {
  const rated = list.filter((i) => i.rating > 0);
  const avg = rated.length ? (rated.reduce((s, i) => s + i.rating, 0) / rated.length / 2).toLocaleString("tr", { maximumFractionDigits: 1 }) : "–";
  const year = new Date().getFullYear().toString();
  const hours = list.reduce((s, i) => s + (Number(i.hours) || 0), 0);
  return [
    [list.length, "Toplam kayıt"],
    [list.filter((i) => i.status === "completed").length, "Bitirilen"],
    [list.filter((i) => i.status === "active").length, "Devam eden"],
    [list.filter((i) => i.status === "completed" && (i.date || "").startsWith(year)).length, "Bu yıl bitirilen"],
    [avg === "–" ? avg : `${avg} ★`, "Ortalama puan"],
    ...(hours ? [[`⏱ ${Math.round(hours).toLocaleString("tr")}`, "Saat oynandı"]] : []),
  ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("");
}

function cardHtml(e, { kind = false, edit = false } = {}) {
  const t = TYPES[e.type];
  const cover = safeUrl(e.cover);
  const meta = [e.creator, e.year].filter(Boolean).join(" · ");
  return `<button class="card" ${edit ? "data-edit" : "data-entry"}="${e.id}">
    <div class="poster ${t.square ? "square" : ""}">
      <div class="ph">${t.icon}</div>
      ${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
      ${kind ? `<span class="kind">${t.icon}</span>` : ""}
      <span class="st badge ${e.status}">${statusLabel(e.status, e.type)}</span>
      ${e.rating ? `<span class="rating">★ ${(e.rating / 2).toLocaleString("tr")}</span>` : ""}
    </div>
    <div class="card-title">${esc(e.title)}</div>
    ${meta ? `<div class="card-meta">${esc(meta)}</div>` : ""}
  </button>`;
}

// Akışta notlar gösterilmez; kayda tıklayan, sahibinin profilinde kaydı açar.
function feedItem(e) {
  const p = e.profiles || {};
  const t = TYPES[e.type];
  const cover = safeUrl(e.cover);
  const link = `#/u/${esc(p.username)}/${e.id}`;
  const extra = [e.platform, e.status === "active" ? e.progress : "", e.hours ? fmtHours(e.hours) : ""].filter(Boolean);
  return `<div class="feed-item">
    <a href="#/u/${esc(p.username)}">${avatarHtml(p)}</a>
    <div class="text">
      <div class="line"><a href="#/u/${esc(p.username)}"><b>${displayName(p)}</b></a> ${esc(activityVerb(e))}:
        <a class="title-link" href="${link}">${esc(e.title)}</a></div>
      <div class="sub"><span>${t.icon} ${t.label}</span>${e.rating ? `<span class="stars">${starsHtml(e.rating)}</span>` : ""}<span>${timeAgo(e.updated_at)}</span></div>
      ${extra.length || e.notes ? `<div class="chips-row">${extra.map((x) => `<span class="tag">${esc(x)}</span>`).join("")}${e.notes ? `<span class="tag ghost">📝 not var</span>` : ""}</div>` : ""}
    </div>
    <a class="thumb" href="${link}">${t.icon}${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" onerror="this.remove()">` : ""}</a>
  </div>`;
}

const feedHtml = (list, empty = `<div class="empty">Henüz hareket yok.</div>`) =>
  list.length ? `<div class="feed">${list.map(feedItem).join("")}</div>` : empty;

function followBtn(id) {
  if (state.me?.id === id) return "";
  if (!state.me) return `<a class="btn primary" href="#/login">+ Takip et</a>`;
  const on = state.following.has(id);
  return `<button class="btn ${on ? "following" : "primary"}" data-follow="${id}">${on ? "✓ Takip ediliyor" : "+ Takip et"}</button>`;
}

function userRow(p) {
  return `<div class="user-row">
    <a href="#/u/${esc(p.username)}">${avatarHtml(p)}</a>
    <a class="who" href="#/u/${esc(p.username)}"><b>${displayName(p)}</b><span>@${esc(p.username)}${p.bio ? " · " + esc(p.bio) : ""}</span></a>
    ${followBtn(p.id)}
  </div>`;
}

// ---------- Yönlendirme ----------

const STALE = Symbol("stale");
let routeSeq = 0;

function show(seq, html) {
  if (seq !== routeSeq) throw STALE; // kullanıcı bu arada başka sayfaya geçti
  $("app").innerHTML = html;
}
const go = (hash) => (location.hash = hash);
const routeName = () => location.hash.replace(/^#\/?/, "").split("/")[0];

const routes = {
  "": viewHome,
  community: viewCommunity,
  u: viewProfile,
  me: () => go(state.me ? `#/u/${state.me.username}` : "#/login"),
  game: viewGame,
  login: viewLogin,
  signup: viewSignup,
  settings: viewSettings,
};

async function route({ keepScroll = false } = {}) {
  const [name, arg = "", extra = ""] = location.hash.replace(/^#\/?/, "").split("/");
  const seq = ++routeSeq;
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const nav = name === "" ? "home" : name === "u" && arg === state.me?.username ? "me" : name === "settings" ? "me" : name;
    a.classList.toggle("active", a.dataset.nav === nav);
  });
  if (!keepScroll) {
    $("app").innerHTML = `<div class="loading">Yükleniyor…</div>`;
    window.scrollTo(0, 0);
  }
  if (!sb) return show(seq, `<div class="empty">Supabase ayarları eksik. <code>config.js</code> dosyasını doldur.</div>`);
  try {
    await (routes[name] || viewNotFound)(decodeURIComponent(arg), seq, extra);
  } catch (err) {
    if (err === STALE) return;
    console.error(err);
    if (seq === routeSeq) $("app").innerHTML = `<div class="empty">Bir şeyler ters gitti: ${esc(err.message)}</div>`;
  }
}
const refresh = () => route({ keepScroll: true });

function viewNotFound(_, seq) {
  show(seq, `<div class="empty">Aradığın sayfa yok. <br><a class="btn" href="#/">Ana sayfaya dön</a></div>`);
}

// ---------- Ana sayfa ----------

async function viewHome(_, seq) {
  if (!state.me) return viewLanding(seq);

  const me = state.me;
  const [mine, friends, community] = await Promise.all([
    fetchEntries(me.id),
    state.following.size ? fetchFeed({ users: [...state.following], limit: 15 }) : [],
    fetchFeed({ limit: 10 }),
  ]);
  remember(mine.map((e) => ({ ...e, profiles: me })));
  const active = mine.filter((e) => e.status === "active");
  const localCount = localEntries().length;
  const hour = new Date().getHours();
  const hello = hour < 6 ? "İyi geceler" : hour < 12 ? "Günaydın" : hour < 18 ? "Selam" : "İyi akşamlar";

  show(seq, `
    <section class="welcome">
      <div>
        <h1>${hello}, <span class="grad">${displayName(me)}</span> 👋</h1>
        <p>${mine.length ? `Kütüphanende ${mine.length} kayıt var.` : "Kütüphanen boş, ilk kaydını ekleyerek başla."}</p>
      </div>
      <button class="btn primary big" data-add>+ Yeni kayıt</button>
    </section>
    ${localCount ? `<div class="banner">
      <span>📦 Bu tarayıcıda hesap öncesinden kalan <b>${localCount}</b> kayıt var.</span>
      <button class="btn primary" id="importLocal">Hesabıma aktar</button>
      <button class="btn ghost" id="dismissLocal">Yoksay</button>
    </div>` : ""}
    <section class="section"><div class="stats">${statsHtml(mine)}</div></section>
    ${active.length ? `<section class="section">
      <div class="section-head"><h2>Devam ettiklerin</h2><a href="#/u/${esc(me.username)}">Kütüphanem →</a></div>
      <div class="strip">${active.map((e) => cardHtml(e, { kind: true, edit: true })).join("")}</div>
    </section>` : ""}
    <div class="cols section">
      <section>
        <div class="section-head"><h2>Arkadaşlarından</h2></div>
        ${feedHtml(friends, `<div class="empty">${state.following.size ? "Takip ettiklerin henüz bir şey loglamadı." : "Henüz kimseyi takip etmiyorsun."}<br><a class="btn" href="#/community">Topluluğa göz at</a></div>`)}
      </section>
      <section>
        <div class="section-head"><h2>Toplulukta</h2><a href="#/community">Tümü →</a></div>
        ${feedHtml(community)}
      </section>
    </div>`);
}

async function viewLanding(seq) {
  const feed = await fetchFeed({ limit: 10 });
  show(seq, `
    <section class="hero">
      <div>
        <h1>Oynadığın, izlediğin, dinlediğin <span class="grad">her şey</span> tek yerde.</h1>
        <p>Oyunlarını, filmlerini, dizilerini, müziklerini ve animelerini logla. Puanla, not al, arkadaşlarının neyle uğraştığını gör.</p>
        <div class="hero-actions">
          <a class="btn primary big" href="#/signup">Ücretsiz katıl</a>
          <a class="btn big ghost" href="#/login">Giriş yap</a>
        </div>
      </div>
      <div class="hero-art">${Object.values(TYPES).map((t) => `<div class="tile">${t.icon}</div>`).join("")}</div>
    </section>
    <div class="features">
      <div class="feature"><span class="ico">📒</span><b>Her şeyi logla</b><span>Oyun, film, dizi, müzik ve anime tek kütüphanede. Durum, puan ve notlarınla.</span></div>
      <div class="feature"><span class="ico">⭐</span><b>Puanla ve hatırla</b><span>Yarım yıldızlı puanlar, tarihler ve kısa incelemelerle neyi ne zaman sevdiğini unutma.</span></div>
      <div class="feature"><span class="ico">👥</span><b>Arkadaşlarını takip et</b><span>Kimin ne oynadığını, ne izlediğini gör; oyun sayfalarında topluluğun puanlarına bak.</span></div>
    </div>
    <section class="section">
      <div class="section-head"><h2>Toplulukta son hareketler</h2><a href="#/community">Tümü →</a></div>
      ${feedHtml(feed)}
    </section>`);
}

// ---------- Topluluk ----------

async function viewCommunity(_, seq) {
  const [feed, members, games] = await Promise.all([
    fetchFeed({ limit: 40 }),
    q(sb.from("profiles").select("*").order("created_at", { ascending: false }).limit(30)),
    q(sb.from("entries").select("rawg_id, title, cover, rating").eq("type", "game").order("updated_at", { ascending: false }).limit(300)),
  ]);

  // Son kayıtlarda en çok loglanan oyunlar
  const byGame = new Map();
  for (const g of games.filter((g) => g.rawg_id)) {
    const s = byGame.get(g.rawg_id) || { ...g, n: 0 };
    s.n++;
    byGame.set(g.rawg_id, s);
  }
  const popular = [...byGame.values()].sort((a, b) => b.n - a.n).slice(0, 12);

  const unique = [...new Set([...games, ...feed].map((e) => safeUrl(e.cover)).filter(Boolean))].slice(0, 30);
  const covers = unique.length ? Array.from({ length: 30 }, (_, i) => unique[i % unique.length]) : []; // az kapak varsa tekrarla
  show(seq, `
    <section class="mosaic-head">
      <div class="mosaic">${covers.map((c) => `<img src="${esc(c)}" alt="" loading="lazy" onerror="this.remove()">`).join("")}</div>
      <div class="mosaic-text"><h1>Topluluk</h1><p>Herkes neyi oynuyor, neyi izliyor? Keşfet, takip et.</p></div>
    </section>
    ${popular.length ? `<section class="section">
      <div class="section-head"><h2>🔥 Popüler oyunlar</h2></div>
      <div class="strip">${popular.map((g) => `<a class="card" href="#/game/${g.rawg_id}">
        <div class="poster"><div class="ph">🎮</div>${safeUrl(g.cover) ? `<img src="${esc(g.cover)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
          <span class="rating">👤 ${g.n}</span></div>
        <div class="card-title">${esc(g.title)}</div></a>`).join("")}</div>
    </section>` : ""}
    <div class="cols section">
      <section>
        <div class="section-head"><h2>Son hareketler</h2></div>
        ${feedHtml(feed)}
      </section>
      <section>
        <div class="section-head"><h2>Üyeler</h2></div>
        <input class="input" id="memberSearch" type="search" placeholder="Kullanıcı ara…" style="width:100%;margin-bottom:12px" autocomplete="off">
        <div class="user-list" id="memberList">${members.map(userRow).join("")}</div>
      </section>
    </div>`);
}

let memberTimer;
async function searchMembers(text) {
  const term = text.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const req = sb.from("profiles").select("*").limit(30);
  const list = await q(term ? req.ilike("username", `%${term}%`) : req.order("created_at", { ascending: false }));
  if ($("memberList")) $("memberList").innerHTML = list.length ? list.map(userRow).join("") : `<div class="muted" style="padding:12px">Kimse bulunamadı.</div>`;
}

// ---------- Profil ----------

async function viewProfile(username, seq, entryId) {
  const profile = await q(sb.from("profiles").select("*").eq("username", username.toLowerCase()).maybeSingle());
  if (!profile) return show(seq, `<div class="empty">@${esc(username)} diye bir kullanıcı yok.</div>`);

  const [entries, followers, following] = await Promise.all([
    fetchEntries(profile.id),
    countOf(sb.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id)),
    countOf(sb.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id)),
  ]);
  entries.forEach((e) => (e.profiles = profile));
  remember(entries);
  const isMe = state.me?.id === profile.id;
  current = { profile, entries, isMe };
  if (lib.user !== profile.id) lib = { user: profile.id, type: "all", status: "all", sort: "updated", q: "", view: savedView() };

  show(seq, `
    <div class="profile-banner"></div>
    <div class="profile-head">
      ${avatarHtml(profile, "lg")}
      <div class="profile-info"><h1>${displayName(profile)}</h1><div class="handle">@${esc(profile.username)}</div></div>
      <div class="profile-actions">${isMe
        ? `<a class="btn" href="#/settings">Profili düzenle</a><button class="btn primary" data-add>+ Ekle</button>`
        : followBtn(profile.id)}</div>
    </div>
    ${profile.bio ? `<p class="profile-bio">${esc(profile.bio)}</p>` : ""}
    <div class="profile-meta">
      <span><b>${entries.length}</b> kayıt</span>
      <button data-list="followers"><b id="followerCount">${followers}</b> takipçi</button>
      <button data-list="following"><b>${following}</b> takip</button>
      <span>📅 ${fmtDate(profile.created_at.slice(0, 10))} tarihinde katıldı</span>
    </div>
    <section class="section">
      <div class="tabs" id="libTabs"></div>
      <div class="stats" id="libStats"></div>
      <div class="toolbar" style="margin-top:18px">
        <div class="chips" id="libChips"></div>
        <div class="right">
          <input class="input" id="libSearch" type="search" placeholder="Kütüphanede ara…" value="${esc(lib.q)}" autocomplete="off">
          <select id="libSort" aria-label="Sırala">
            <option value="updated">Son eklenen</option>
            <option value="rating">Puan (yüksek)</option>
            <option value="title">İsim (A-Z)</option>
            <option value="year">Yıl (yeni)</option>
            <option value="hours">Süre (uzun)</option>
          </select>
          <div class="seg" id="viewToggle">
            <button type="button" data-view="grid" title="Izgara">▦</button>
            <button type="button" data-view="list" title="Liste">☰</button>
          </div>
        </div>
      </div>
      <div id="libGrid"></div>
    </section>`);
  $("libSort").value = lib.sort;
  updateLibrary();
  if (entryId && cache.has(entryId)) openView(cache.get(entryId));
}

function updateLibrary() {
  if (!current || !$("libGrid")) return;
  const { entries, isMe } = current;
  const scoped = lib.type === "all" ? entries : entries.filter((e) => e.type === lib.type);

  const tabs = [["all", "✨", "Tümü"], ...Object.entries(TYPES).map(([k, t]) => [k, t.icon, t.label])];
  $("libTabs").innerHTML = tabs.map(([k, icon, label]) => {
    const n = k === "all" ? entries.length : entries.filter((e) => e.type === k).length;
    return `<button class="tab ${lib.type === k ? "active" : ""}" data-libtype="${k}">${icon} ${label}<span class="count">${n}</span></button>`;
  }).join("");

  $("libStats").innerHTML = statsHtml(scoped);

  const type = lib.type === "all" ? null : lib.type;
  $("libChips").innerHTML = [["all", "Hepsi"], ...STATUSES.map((s) => [s, statusLabel(s, type)])].map(([k, label]) =>
    `<button class="chip ${lib.status === k ? "active" : ""}" data-libstatus="${k}">${label}</button>`).join("");

  const text = lib.q.trim().toLocaleLowerCase("tr");
  const sorters = {
    updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
    rating: (a, b) => b.rating - a.rating || b.updated_at.localeCompare(a.updated_at),
    title: (a, b) => a.title.localeCompare(b.title, "tr"),
    year: (a, b) => (b.year || 0) - (a.year || 0),
    hours: (a, b) => (Number(b.hours) || 0) - (Number(a.hours) || 0),
  };
  document.querySelectorAll("#viewToggle [data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === lib.view));
  const list = scoped
    .filter((e) => (lib.status === "all" || e.status === lib.status) &&
      (!text || `${e.title} ${e.creator || ""} ${e.notes || ""}`.toLocaleLowerCase("tr").includes(text)))
    .sort(sorters[lib.sort]);

  $("libGrid").innerHTML = list.length
    ? lib.view === "list"
      ? `<div class="rows">${list.map((e) => rowHtml(e, isMe)).join("")}</div>`
      : `<div class="grid">${list.map((e) => cardHtml(e, { kind: lib.type === "all" })).join("")}</div>`
    : `<div class="empty">${entries.length ? "Bu filtreye uyan kayıt yok." : isMe
        ? `Henüz hiçbir şey loglamadın.<br><button class="btn primary" data-add>+ İlk kaydını ekle</button>`
        : "Burada henüz kayıt yok."}</div>`;
}

function savedView() {
  try { return localStorage.getItem("ancalog.view") || "grid"; } catch { return "grid"; }
}

// Liste görünümünde bir satır: kapak, başlık, platform/durum/mağaza, ilerleme, süre, puan
function rowHtml(e, isMe) {
  const t = TYPES[e.type];
  const cover = safeUrl(e.cover);
  const dates = [e.started_on && `${fmtDate(e.started_on)}`, e.date && `${fmtDate(e.date)}`].filter(Boolean).join(" → ");
  return `<div class="lrow">
    <button class="lrow-cover poster ${t.square ? "square" : ""}" data-entry="${e.id}">
      <div class="ph">${t.icon}</div>${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
    </button>
    <div class="lrow-main">
      <div class="lrow-head">
        <button class="lrow-title" data-entry="${e.id}">${esc(e.title)}${e.year ? ` <span class="muted">(${e.year})</span>` : ""}</button>
        <div class="lrow-tags">
          ${e.platform ? `<span class="tag">${esc(e.platform)}</span>` : ""}
          <span class="pill ${e.status}">${statusLabel(e.status, e.type)}</span>
          ${e.store ? `<span class="tag">${esc(e.store)}</span>` : ""}
        </div>
      </div>
      ${e.progress ? `<div class="lrow-progress">${esc(e.progress)}</div>` : ""}
      <div class="lrow-foot">
        ${e.rating ? `<span class="stars">${starsHtml(e.rating)}</span>` : `<span class="muted">Puan yok</span>`}
        ${e.hours ? `<span>⏱ ${fmtHours(e.hours)}</span>` : ""}
        ${dates ? `<span>📅 ${dates}</span>` : ""}
        ${e.notes ? `<span>📝 Not</span>` : ""}
      </div>
    </div>
    ${isMe ? `<button class="icon-btn lrow-edit" data-edit="${e.id}" title="Düzenle">✎</button>` : ""}
  </div>`;
}

async function openUserList(kind) {
  const p = current.profile;
  const [col, other] = kind === "followers" ? ["follower_id", "following_id"] : ["following_id", "follower_id"];
  $("listTitle").textContent = kind === "followers" ? "Takipçiler" : "Takip edilenler";
  $("listBody").innerHTML = `<div class="loading">Yükleniyor…</div>`;
  $("listDialog").showModal();
  const ids = (await q(sb.from("follows").select(col).eq(other, p.id))).map((r) => r[col]);
  const users = ids.length ? await q(sb.from("profiles").select("*").in("id", ids)) : [];
  $("listBody").innerHTML = users.length ? users.map(userRow).join("") : `<div class="muted" style="padding:12px 14px">Henüz kimse yok.</div>`;
}

async function toggleFollow(id, btn) {
  btn.disabled = true;
  const on = state.following.has(id);
  try {
    if (on) {
      await q(sb.from("follows").delete().eq("follower_id", state.me.id).eq("following_id", id));
      state.following.delete(id);
    } else {
      await q(sb.from("follows").insert({ follower_id: state.me.id, following_id: id }));
      state.following.add(id);
    }
    document.querySelectorAll(`[data-follow="${id}"]`).forEach((b) => (b.outerHTML = followBtn(id)));
    if (current?.profile.id === id && $("followerCount")) $("followerCount").textContent = +$("followerCount").textContent + (on ? -1 : 1);
  } catch (err) {
    btn.disabled = false;
    toast("Olmadı: " + err.message);
  }
}

// ---------- Oyun sayfası ----------

async function viewGame(id, seq) {
  const [g, logs, shots] = await Promise.all([
    rawg(`games/${encodeURIComponent(id)}`).catch(() => null),
    q(sb.from("entries").select(ENTRY_COLS).eq("rawg_id", Number(id) || 0).order("updated_at", { ascending: false }).limit(200)),
    rawg(`games/${encodeURIComponent(id)}/screenshots`, { page_size: 5 }).then((r) => r.results || []).catch(() => []),
  ]);
  if (!g && !logs.length) return show(seq, `<div class="empty">Bu oyun bulunamadı.</div>`);
  remember(logs);
  currentGame = g;

  const name = g?.name || logs[0].title;
  const art = safeUrl(g?.background_image) ? resized(g.background_image) : safeUrl(logs[0]?.cover);
  const rated = logs.filter((l) => l.rating);
  const avg = rated.length ? rated.reduce((s, l) => s + l.rating, 0) / rated.length / 2 : 0;
  const timed = logs.filter((l) => Number(l.hours) > 0);
  const avgHours = timed.length ? timed.reduce((s, l) => s + Number(l.hours), 0) / timed.length : 0;
  const mine = state.me && logs.find((l) => l.user_id === state.me.id);
  const count = (s) => logs.filter((l) => l.status === s).length;
  const names = (list) => (list || []).map((x) => x.name || x.platform?.name || x.store?.name).filter(Boolean);
  const devs = names(g?.developers).join(", ");
  const desc = (g?.description_raw || "").trim();
  const action = !state.me ? `<a class="btn primary wide" href="#/login">+ Kütüphaneme ekle</a>`
    : mine ? `<button class="btn primary wide" data-edit="${mine.id}">${TYPES.game.icon} ${statusLabel(mine.status, "game")} · Düzenle</button>`
    : g ? `<button class="btn primary wide" data-add-game>+ Kütüphaneme ekle</button>` : "";
  const facts = [
    ["Geliştirici", names(g?.developers).join("\n")],
    ["Yayıncı", names(g?.publishers).join("\n")],
    ["Çıkış tarihi", g?.released ? fmtDate(g.released) : ""],
    ["Ortalama süre (RAWG)", g?.playtime ? fmtHours(g.playtime) : ""],
    ["Ortalama süre (Ancalog)", avgHours ? fmtHours(avgHours) : ""],
    ["Mağazalar", names(g?.stores).join("\n")],
    ["Yaş sınırı", g?.esrb_rating?.name || ""],
  ].filter(([, v]) => v);

  show(seq, `
    <section class="gh">
      <div class="gh-bg" style="${art ? `background-image:${cssUrl(art)}` : ""}"></div>
      <div class="gh-inner">
        <div class="gh-left">
          <div class="gh-cover">${art ? `<img src="${esc(art)}" alt="">` : `<div class="ph">🎮</div>`}</div>
          <div class="gh-counts">
            <span title="Kütüphanesine ekleyen">📚 ${logs.length}</span>
            <span title="Oynuyor">▶ ${count("active")}</span>
            <span title="Bitirdi">🏆 ${count("completed")}</span>
            <span title="Planlıyor">📋 ${count("planned")}</span>
          </div>
          ${action}
        </div>
        <div class="gh-main">
          <div class="crumbs"><a href="#/community">Oyunlar</a> / ${esc(name)}</div>
          <h1>${esc(name)} ${g?.released ? `<small>${g.released.slice(0, 4)}</small>` : ""}</h1>
          ${devs ? `<div class="gh-dev">${esc(devs)}</div>` : ""}
          ${desc ? `<p class="gh-desc clamp" id="gameDesc">${esc(desc)}</p>${desc.length > 300 ? `<button class="link" id="moreDesc">Devamını oku</button>` : ""}` : ""}
          ${g?.platforms?.length ? `<div class="gh-line"><b>Platformlar:</b> ${esc(names(g.platforms).join(", "))}</div>` : ""}
          ${g?.genres?.length ? `<div class="genres">${g.genres.map((x) => `<span>${esc(x.name)}</span>`).join("")}</div>` : ""}
        </div>
        <div class="gh-score">
          <div><b>★ ${avg ? avg.toLocaleString("tr", { maximumFractionDigits: 1 }) : "–"}<small>/5</small></b><span>${rated.length} oy · Ancalog</span></div>
          ${g?.metacritic ? `<div><b class="mc">${g.metacritic}</b><span>Metacritic</span></div>` : ""}
        </div>
      </div>
    </section>
    <div class="game-body">
      <aside class="facts">${facts.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join("")}
        <span class="muted" style="font-size:12px">Oyun bilgileri: <a href="https://rawg.io/games/${esc(g?.slug || id)}" target="_blank" rel="noopener" style="color:var(--accent-2)">RAWG</a></span>
      </aside>
      <div>
        ${shots.length ? `<div class="shots">${shots.map((s) => `<a href="${esc(s.image)}" target="_blank" rel="noopener"><img src="${esc(resized(s.image))}" alt="" loading="lazy"></a>`).join("")}</div>` : ""}
        <section class="section">
          <div class="section-head"><h2>Ancalog'da kimler logladı</h2></div>
          ${feedHtml(logs, `<div class="empty">Henüz kimse loglamadı. İlk sen ol!</div>`)}
        </section>
      </div>
    </div>`);
}

// ---------- Giriş / kayıt ----------

const AUTH_ERRORS = {
  "Invalid login credentials": "E-posta ya da şifre yanlış.",
  "Email not confirmed": "E-postanı henüz onaylamadın. Gelen kutuna bak.",
  "User already registered": "Bu e-posta zaten kayıtlı. Giriş yapmayı dene.",
  "Password should be at least 6 characters.": "Şifre en az 6 karakter olmalı.",
};
const authError = (err) => AUTH_ERRORS[err.message] || err.message;

function viewLogin(_, seq) {
  if (state.me) return go("#/");
  show(seq, `
    <form class="auth" id="loginForm">
      <h1>Tekrar hoş geldin 👋</h1>
      <div class="field"><label for="l-email">E-posta</label><input id="l-email" type="email" required autocomplete="email"></div>
      <div class="field"><label for="l-pass">Şifre</label><input id="l-pass" type="password" required autocomplete="current-password"></div>
      <p class="form-error" id="authError" hidden></p>
      <button class="btn primary big">Giriş yap</button>
      <div class="alt">Hesabın yok mu? <a href="#/signup">Kayıt ol</a></div>
    </form>`);
  $("l-email").focus();
}

function viewSignup(_, seq) {
  if (state.me) return go("#/");
  show(seq, `
    <form class="auth" id="signupForm">
      <h1>Ancalog'a katıl ✨</h1>
      <div class="field"><label for="s-user">Kullanıcı adı</label>
        <input id="s-user" required minlength="3" maxlength="20" pattern="[a-zA-Z0-9_]+" autocomplete="username" placeholder="ornek_kullanici">
        <span class="muted" style="font-size:12px">3-20 karakter: harf, rakam ve _ . Profil linkin bu olur.</span></div>
      <div class="field"><label for="s-email">E-posta</label><input id="s-email" type="email" required autocomplete="email"></div>
      <div class="field"><label for="s-pass">Şifre</label><input id="s-pass" type="password" required minlength="6" autocomplete="new-password"></div>
      <p class="form-error" id="authError" hidden></p>
      <button class="btn primary big">Hesap oluştur</button>
      <div class="alt">Zaten hesabın var mı? <a href="#/login">Giriş yap</a></div>
    </form>`);
  $("s-user").focus();
}

function setAuthError(msg) {
  $("authError").textContent = msg;
  $("authError").hidden = !msg;
}

async function submitLogin(form) {
  const btn = form.querySelector("button");
  btn.disabled = true;
  setAuthError("");
  const { error } = await sb.auth.signInWithPassword({ email: $("l-email").value.trim(), password: $("l-pass").value });
  btn.disabled = false;
  if (error) setAuthError(authError(error)); // başarıda onAuthStateChange devralır
}

async function submitSignup(form) {
  const typed = $("s-user").value.trim();
  const username = typed.toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return setAuthError("Kullanıcı adı 3-20 karakter olmalı; sadece harf, rakam ve _ .");
  const btn = form.querySelector("button");
  btn.disabled = true;
  setAuthError("");
  try {
    const taken = await q(sb.from("profiles").select("id").eq("username", username).maybeSingle());
    if (taken) return setAuthError("Bu kullanıcı adı alınmış, başka bir tane dene.");
    const { data, error } = await sb.auth.signUp({
      email: $("s-email").value.trim(),
      password: $("s-pass").value,
      options: { data: { username, display_name: typed }, emailRedirectTo: location.origin + location.pathname },
    });
    if (error) return setAuthError(authError(error));
    if (!data.session) {
      form.innerHTML = `<h1>Neredeyse tamam 📬</h1><p>E-postana bir onay linki gönderdik. Linke tıkladıktan sonra giriş yapabilirsin.</p><a class="btn primary" href="#/login">Giriş sayfasına git</a>`;
    }
  } catch (err) {
    setAuthError(authError(err));
  } finally {
    btn.disabled = false;
  }
}

// ---------- Ayarlar ----------

function viewSettings(_, seq) {
  if (!state.me) return go("#/login");
  const me = state.me;
  show(seq, `
    <form class="auth settings" id="settingsForm">
      <h1>Profili düzenle</h1>
      <div class="view-user">${avatarHtml(me, "")} <span>@${esc(me.username)}</span></div>
      <div class="field"><label for="p-name">Görünen ad</label><input id="p-name" maxlength="40" value="${esc(me.display_name || "")}"></div>
      <div class="field"><label for="p-bio">Hakkımda</label><textarea id="p-bio" rows="3" maxlength="300">${esc(me.bio || "")}</textarea></div>
      <div class="field"><label for="p-avatar">Profil fotoğrafı (https:// ile başlayan resim linki)</label><input id="p-avatar" type="url" value="${esc(me.avatar_url || "")}" placeholder="https://…"></div>
      <p class="form-error" id="authError" hidden></p>
      <div class="actions">
        <button class="btn primary">Kaydet</button>
        <a class="btn ghost" href="#/u/${esc(me.username)}">Profilime dön</a>
      </div>
      <hr style="border:0;border-top:1px solid var(--border);width:100%">
      <div class="actions">
        <button type="button" class="btn" id="exportBtn">Verilerimi indir (JSON)</button>
        <span class="spacer"></span>
        <button type="button" class="btn danger" id="signOutBtn">Çıkış yap</button>
      </div>
    </form>`);
}

async function submitSettings(form) {
  const avatar = $("p-avatar").value.trim();
  if (avatar && !avatar.startsWith("https://")) return setAuthError("Fotoğraf linki https:// ile başlamalı.");
  const btn = form.querySelector("button");
  btn.disabled = true;
  try {
    state.me = await q(sb.from("profiles").update({
      display_name: $("p-name").value.trim() || null,
      bio: $("p-bio").value.trim() || null,
      avatar_url: avatar || null,
    }).eq("id", state.me.id).select().single());
    renderTopbar();
    toast("Profil kaydedildi ✓");
    go(`#/u/${state.me.username}`);
  } catch (err) {
    setAuthError(err.message);
  } finally {
    btn.disabled = false;
  }
}

async function exportMine() {
  const data = await fetchEntries(state.me.id);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ancalog-${state.me.username}-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- Eski (tarayıcıdaki) kayıtları hesaba aktarma ----------

function localEntries() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch { return []; }
}

async function importLocal(btn) {
  btn.disabled = true;
  btn.textContent = "Aktarılıyor…";
  try {
    const rows = [];
    for (const i of localEntries().filter((i) => i && i.title && TYPES[i.type])) {
      const row = {
        user_id: state.me.id, type: i.type, title: String(i.title).slice(0, 200),
        year: parseInt(i.year) || null, creator: i.creator || null,
        status: STATUSES.includes(i.status) ? i.status : "completed",
        date: i.date || null, rating: Math.max(0, Math.min(10, parseInt(i.rating) || 0)),
        cover: safeUrl(i.cover) || null, notes: i.notes || null, rawg_id: null,
        updated_at: new Date(i.updated || Date.now()).toISOString(),
      };
      if (i.type === "game" && RAWG_KEY) {
        // Oyunu RAWG'de bul, topluluk sayfasına bağlansın
        const found = (await rawg("games", { search: i.title, page_size: 5 }).catch(() => ({}))).results || [];
        const g = found.find((x) => x.name.toLowerCase() === row.title.toLowerCase()) || found[0];
        if (g) row.rawg_id = g.id;
      }
      rows.push(row);
    }
    if (rows.length) await q(sb.from("entries").insert(rows));
    localStorage.setItem(LOCAL_KEY + ".imported", localStorage.getItem(LOCAL_KEY));
    localStorage.removeItem(LOCAL_KEY);
    toast(`${rows.length} kayıt hesabına aktarıldı ✓`);
    refresh();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Hesabıma aktar";
    toast("Aktarılamadı: " + err.message);
  }
}

// ---------- Kayıt görüntüleme ----------

let viewing = null;
function openView(e) {
  viewing = e;
  const t = TYPES[e.type];
  const p = e.profiles || {};
  const cover = safeUrl(e.cover);
  const mine = state.me?.id === e.user_id;
  const details = [
    [t.where, e.platform],
    ["Mağaza", e.store],
    ["Başladı", e.started_on && fmtDate(e.started_on)],
    [e.status === "completed" ? "Bitirdi" : "Tarih", e.date && fmtDate(e.date)],
    ["Süre", e.hours && fmtHours(e.hours)],
    ["İlerleme", e.progress],
  ].filter(([, v]) => v);
  $("viewBody").innerHTML = `
    <div class="view-cover" style="${cover ? `background-image:${cssUrl(cover)}` : "background:linear-gradient(120deg,#3b1f7a,#db2777)"}">
      <button type="button" class="icon-btn" data-close aria-label="Kapat">✕</button>
    </div>
    <div class="view-content">
      <div><span class="badge ${e.status}">${t.icon} ${statusLabel(e.status, e.type)}</span></div>
      <h2>${esc(e.title)}</h2>
      ${e.creator || e.year ? `<div class="muted">${esc([e.creator, e.year].filter(Boolean).join(" · "))}</div>` : ""}
      ${e.rating ? `<div class="stars" style="font-size:22px">${starsHtml(e.rating)}</div>` : ""}
      ${p.username ? `<div class="view-user">${avatarHtml(p, "sm")} <a href="#/u/${esc(p.username)}">${displayName(p)}</a></div>` : ""}
      ${details.length ? `<div class="view-details">${details.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join("")}</div>` : ""}
      ${e.notes ? `<div class="view-notes">${esc(e.notes)}</div>` : ""}
      <div class="actions">
        ${e.rawg_id ? `<a class="btn" href="#/game/${e.rawg_id}">Oyun sayfası →</a>` : ""}
        <span class="spacer"></span>
        ${mine ? `<button type="button" class="btn primary" data-edit-viewing>Düzenle</button>` : ""}
      </div>
    </div>`;
  $("viewDialog").showModal();
}

// ---------- Kayıt formu ----------

let editing = null;   // düzenlenen kayıt
let formType = "game";
let formRating = 0;   // 0-10 (yarım yıldız = 1 puan)
let formGame = null;  // seçilen oyun: { rawg_id, title, year, cover, creator }

function openForm(item, { game } = {}) {
  if (!state.me) return go("#/login");
  editing = item || null;
  formType = item?.type || (game ? "game" : current?.isMe && lib.type !== "all" ? lib.type : "game");
  formRating = item?.rating || 0;
  formGame = item?.type === "game" && item.rawg_id
    ? { rawg_id: item.rawg_id, title: item.title, year: item.year, cover: item.cover, creator: item.creator }
    : game ? gameFromRawg(game) : null;
  $("formTitle").textContent = item ? "Kaydı düzenle" : "Yeni kayıt";
  $("f-title").value = item && !formGame ? item.title : "";
  $("f-year").value = item?.year || "";
  $("f-creator").value = item?.creator || "";
  $("f-date").value = item?.date || "";
  $("f-start").value = item?.started_on || "";
  $("f-platform").value = item?.platform || "";
  $("f-store").value = item?.store || "";
  $("f-hours").value = item?.hours ?? "";
  $("f-progress").value = item?.progress || "";
  $("f-cover").value = item?.cover || "";
  $("f-notes").value = item?.notes || "";
  $("f-status").innerHTML = "";
  renderTypePicker();
  $("f-status").value = item?.status || "completed";
  renderStarInput();
  setFormError("");
  $("deleteBtn").hidden = !item;
  $("dialog").showModal();
  if (!formGame) $("f-title").focus();
  // Kayıtlı oyunu düzenlerken platform/mağaza önerileri için RAWG'den detayı çek
  if (formGame && !game) loadGameOptions(formGame.rawg_id);
}

function gameFromRawg(g) {
  return {
    rawg_id: g.id, title: g.name, year: parseInt(g.released) || null,
    cover: g.background_image ? smallImage(g.background_image) : null,
    creator: (g.developers || []).map((d) => d.name).join(", ") || null,
    platforms: (g.platforms || []).map((p) => p.platform.name),
    stores: (g.stores || []).map((s) => s.store.name),
  };
}

async function loadGameOptions(id) {
  try {
    const d = await rawg(`games/${id}`);
    if (formGame?.rawg_id !== id) return;
    const full = gameFromRawg(d);
    Object.assign(formGame, { platforms: full.platforms, stores: full.stores });
    if (!formGame.creator) formGame.creator = full.creator;
    fillOptions();
    renderPicked();
  } catch { /* öneriler olmadan da yazılabilir */ }
}

// Platform ve mağaza kutularının önerileri: seçilen oyunun RAWG listesi önce, sonra genel liste
function fillOptions() {
  const uniq = (list) => [...new Set(list)];
  const isGame = formType === "game";
  const places = uniq([...(isGame ? formGame?.platforms || [] : []), ...TYPES[formType].places]);
  const stores = uniq([...(formGame?.stores || []), ...STORES]);
  $("platformList").innerHTML = places.map((p) => `<option value="${esc(p)}">`).join("");
  $("storeList").innerHTML = stores.map((s) => `<option value="${esc(s)}">`).join("");
}

function setFormError(msg) {
  $("formError").textContent = msg;
  $("formError").hidden = !msg;
}

function renderTypePicker() {
  hideSuggest();
  const isGame = formType === "game";
  $("typePicker").innerHTML = Object.entries(TYPES).map(([k, t]) =>
    `<button type="button" data-type="${k}" class="${formType === k ? "active" : ""}">${t.icon} ${t.label}</button>`).join("");
  $("titleLabel").textContent = isGame ? "Oyun ara" : "İsim";
  $("f-title").placeholder = isGame ? "Oyunun adını yaz ve listeden seç…" : "";
  $("creatorLabel").textContent = TYPES[formType].creator;
  $("platformLabel").textContent = TYPES[formType].where;
  $("f-progress").placeholder = TYPES[formType].progress;
  document.querySelectorAll(".manual-only").forEach((el) => (el.hidden = isGame));
  document.querySelectorAll(".game-only").forEach((el) => (el.hidden = !isGame));
  fillOptions();
  const cur = $("f-status").value || "completed";
  $("f-status").innerHTML = STATUSES.map((s) => `<option value="${s}">${statusLabel(s, formType)}</option>`).join("");
  $("f-status").value = cur;
  renderPicked();
}

function renderPicked() {
  const show = formType === "game" && formGame;
  $("f-title").hidden = !!show;
  $("picked").hidden = !show;
  if (!show) return;
  const cover = safeUrl(formGame.cover);
  $("picked").innerHTML = `
    ${cover ? `<img src="${esc(cover)}" alt="">` : `<span class="noimg"></span>`}
    <div class="info"><b>${esc(formGame.title)}</b><span>${esc([formGame.year, formGame.creator].filter(Boolean).join(" · "))}</span></div>
    <button type="button" class="btn" id="changeGame">Değiştir</button>`;
}

function renderStarInput() {
  $("stars").innerHTML = starsHtml(formRating) + `<button type="button" class="link clear">temizle</button>`;
  $("ratingText").textContent = formRating ? `(${(formRating / 2).toLocaleString("tr")} / 5)` : "";
}

async function submitForm() {
  setFormError("");
  let data;
  const isGame = formType === "game";
  if (isGame) {
    if (!formGame) return setFormError("Listeden bir oyun seçmelisin.");
    const { rawg_id, title, year, cover, creator } = formGame;
    data = { rawg_id, title, year, cover, creator };
  } else {
    const title = $("f-title").value.trim();
    const cover = $("f-cover").value.trim();
    if (!title) return setFormError("İsim boş olamaz.");
    if (cover && !safeUrl(cover)) return setFormError("Kapak linki http:// ya da https:// ile başlamalı.");
    data = { title, year: parseInt($("f-year").value) || null, creator: $("f-creator").value.trim() || null, cover: cover || null, rawg_id: null };
  }
  const status = $("f-status").value;
  const started = $("f-start").value || null;
  // Bitti işaretlenip tarih girilmediyse bugünü yaz (yıllık istatistik için)
  const finished = $("f-date").value || (status === "completed" ? today() : null);
  if (started && finished && started > finished) return setFormError("Başlama tarihi bitirme tarihinden sonra olamaz.");
  const hours = isGame && $("f-hours").value !== "" ? Number($("f-hours").value) : null;
  if (hours !== null && !(hours >= 0 && hours < 100000)) return setFormError("Oynama süresi geçerli bir sayı olmalı.");
  Object.assign(data, {
    type: formType,
    status,
    date: finished,
    started_on: started,
    platform: $("f-platform").value.trim() || null,
    store: isGame ? $("f-store").value.trim() || null : null,
    hours,
    progress: $("f-progress").value.trim() || null,
    rating: formRating,
    notes: $("f-notes").value.trim() || null,
    updated_at: new Date().toISOString(),
  });

  $("saveBtn").disabled = true;
  try {
    if (data.rawg_id && editing?.rawg_id !== data.rawg_id) {
      const dupe = await q(sb.from("entries").select("id").eq("user_id", state.me.id).eq("rawg_id", data.rawg_id).limit(1));
      if (dupe.length) return setFormError("Bu oyun zaten kütüphanende var.");
    }
    if (editing) await q(sb.from("entries").update(data).eq("id", editing.id));
    else await q(sb.from("entries").insert({ ...data, user_id: state.me.id }));
    $("dialog").close();
    toast(editing ? "Kayıt güncellendi ✓" : "Kütüphanene eklendi ✓");
    refresh();
  } catch (err) {
    setFormError("Kaydedilemedi: " + err.message);
  } finally {
    $("saveBtn").disabled = false;
  }
}

async function deleteEntry() {
  if (!editing || !confirm(`“${editing.title}” silinsin mi?`)) return;
  try {
    await q(sb.from("entries").delete().eq("id", editing.id));
    $("dialog").close();
    toast("Kayıt silindi");
    refresh();
  } catch (err) {
    setFormError("Silinemedi: " + err.message);
  }
}

// ---------- Oyun araması (RAWG) ----------

let searchTimer;
let searchSeq = 0;    // geç gelen eski cevapları yok saymak için
let suggestions = [];

function hideSuggest() {
  clearTimeout(searchTimer);
  searchSeq++;
  $("suggest").hidden = true;
}

function rawg(path, params = {}) {
  const qs = new URLSearchParams({ key: RAWG_KEY, ...params });
  return fetch(`https://api.rawg.io/api/${path}?${qs}`).then((r) => {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  });
}

// RAWG'nin küçültülmüş görsel adresi (tam boy görseller birkaç MB olabiliyor)
const smallImage = (url) => url.replace(/\/media\/(games|screenshots)\//, "/media/crop/600/400/$1/");

function showSuggest(html) {
  $("suggest").innerHTML = html +
    `<span class="credit">Veri: <a href="https://rawg.io" target="_blank" rel="noopener">RAWG</a></span>`;
  $("suggest").hidden = false;
}

async function searchGames(text) {
  const seq = ++searchSeq;
  try {
    const data = await rawg("games", { search: text, page_size: 6 });
    if (seq !== searchSeq) return;
    suggestions = data.results || [];
    showSuggest(suggestions.length
      ? suggestions.map((g, i) => `<button type="button" data-i="${i}">
          ${g.background_image ? `<img src="${esc(smallImage(g.background_image))}" alt="" onerror="this.style.visibility='hidden'">` : `<span class="noimg"></span>`}
          <span class="name">${esc(g.name)}</span>
          <span class="year">${(g.released || "").slice(0, 4)}</span>
        </button>`).join("")
      : `<div class="note">Sonuç yok. Farklı yazmayı dene.</div>`);
  } catch {
    if (seq === searchSeq) showSuggest(`<div class="note">Arama şu an çalışmıyor.</div>`);
  }
}

async function pickGame(g) {
  hideSuggest();
  setFormError("");
  formGame = gameFromRawg(g);
  fillOptions();
  renderPicked();
  loadGameOptions(g.id); // arama sonucunda geliştirici yok, detaydan gelir
}

// ---------- Üst bar ----------

function renderTopbar() {
  $("topActions").innerHTML = state.me
    ? `<button class="btn primary" data-add>+ Ekle</button><a href="#/u/${esc(state.me.username)}" title="Profilim">${avatarHtml(state.me)}</a>`
    : `<a class="btn ghost" href="#/login">Giriş yap</a><a class="btn primary" href="#/signup">Kayıt ol</a>`;
}

// ---------- Olaylar ----------

document.addEventListener("click", (e) => {
  const t = e.target;
  const el = (sel) => t.closest(sel);
  let x;

  if (t.tagName === "DIALOG" && t.id !== "dialog") return t.close(); // arka plana tıklama
  if ((x = el("[data-close]"))) return x.closest("dialog").close();
  if (el("[data-add]")) return openForm(null);
  if (el("[data-add-game]")) return openForm(null, { game: currentGame });
  if ((x = el("[data-edit]"))) return openForm(cache.get(x.dataset.edit));
  if ((x = el("[data-entry]"))) return openView(cache.get(x.dataset.entry));
  if (el("[data-edit-viewing]")) { $("viewDialog").close(); return openForm(viewing); }
  if ((x = el("[data-follow]"))) return toggleFollow(x.dataset.follow, x);
  if ((x = el("[data-list]"))) return openUserList(x.dataset.list);
  if ((x = el("[data-libtype]"))) { lib.type = x.dataset.libtype; lib.status = "all"; return updateLibrary(); }
  if ((x = el("[data-libstatus]"))) { lib.status = x.dataset.libstatus; return updateLibrary(); }
  if ((x = el("[data-view]"))) {
    lib.view = x.dataset.view;
    try { localStorage.setItem("ancalog.view", lib.view); } catch { /* sadece tercih */ }
    return updateLibrary();
  }
  if (el("#moreDesc")) { $("gameDesc").classList.remove("clamp"); return el("#moreDesc").remove(); }
  if (el("#importLocal")) return importLocal($("importLocal"));
  if (el("#dismissLocal")) {
    localStorage.setItem(LOCAL_KEY + ".dismissed", localStorage.getItem(LOCAL_KEY));
    localStorage.removeItem(LOCAL_KEY);
    return el(".banner").remove();
  }
  if (el("#exportBtn")) return exportMine();
  if (el("#signOutBtn")) return sb.auth.signOut();

  // Form içi
  if ((x = el("#typePicker [data-type]"))) { formType = x.dataset.type; setFormError(""); return renderTypePicker(); }
  if (el("#changeGame")) { formGame = null; $("f-title").value = ""; renderPicked(); return $("f-title").focus(); }
  if ((x = el("#suggest button[data-i]"))) return pickGame(suggestions[x.dataset.i]);
  if (el("#stars .clear")) { formRating = 0; return renderStarInput(); }
  if ((x = el("#stars .star"))) {
    formRating = x.dataset.i * 2 - (e.offsetX < x.offsetWidth / 2 ? 1 : 0);
    return renderStarInput();
  }
  if (el("#deleteBtn")) return deleteEntry();
  if (!el(".suggest-wrap")) hideSuggest();
});

document.addEventListener("submit", (e) => {
  e.preventDefault();
  const id = e.target.id;
  if (id === "form") submitForm();
  if (id === "loginForm") submitLogin(e.target);
  if (id === "signupForm") submitSignup(e.target);
  if (id === "settingsForm") submitSettings(e.target);
});

document.addEventListener("input", (e) => {
  const id = e.target.id;
  if (id === "libSearch") { lib.q = e.target.value; updateLibrary(); }
  if (id === "memberSearch") { clearTimeout(memberTimer); memberTimer = setTimeout(() => searchMembers(e.target.value), 250); }
  if (id === "f-title") {
    hideSuggest();
    const text = e.target.value.trim();
    if (formType !== "game" || !RAWG_KEY || text.length < 2) return;
    searchTimer = setTimeout(() => searchGames(text), 300);
  }
});

document.addEventListener("change", (e) => {
  if (e.target.id === "libSort") { lib.sort = e.target.value; updateLibrary(); }
});

$("f-title").addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" && !$("suggest").hidden) {
    e.preventDefault();
    $("suggest").querySelector("button")?.focus();
  }
});
$("suggest").addEventListener("keydown", (e) => {
  const b = document.activeElement;
  if (e.key === "ArrowDown") { e.preventDefault(); b.nextElementSibling?.focus?.(); }
  if (e.key === "ArrowUp") { e.preventDefault(); (b.previousElementSibling || $("f-title")).focus(); }
  if (e.key === "Escape") { e.preventDefault(); hideSuggest(); $("f-title").focus(); }
});
$("dialog").addEventListener("close", hideSuggest);
// Akıştan açılan kaydın id'sini adresten sil (sayfa yenilenince tekrar açılmasın)
$("viewDialog").addEventListener("close", () => {
  const parts = location.hash.split("/");
  if (parts[1] === "u" && parts.length > 3) history.replaceState(null, "", parts.slice(0, 3).join("/"));
});

window.addEventListener("hashchange", () => route());

// ---------- Başlangıç ----------

async function loadMe(user) {
  state.user = user;
  state.me = null;
  state.following = new Set();
  if (!user) return;
  state.me = await q(sb.from("profiles").select("*").eq("id", user.id).maybeSingle());
  const f = await q(sb.from("follows").select("following_id").eq("follower_id", user.id));
  state.following = new Set(f.map((r) => r.following_id));
}

(async () => {
  if (sb) {
    const { data } = await sb.auth.getSession();
    await loadMe(data.session?.user || null).catch(console.error);
    sb.auth.onAuthStateChange((_event, session) => {
      if ((session?.user?.id ?? null) === (state.user?.id ?? null)) return;
      // Supabase, bu callback içinde doğrudan başka Supabase çağrısı yapılmasını önermiyor
      setTimeout(async () => {
        await loadMe(session?.user || null).catch(console.error);
        renderTopbar();
        if (["login", "signup"].includes(routeName()) && state.me) go("#/");
        else if (routeName() === "settings" && !state.me) go("#/");
        else route();
      });
    });
  }
  renderTopbar();
  route();
})();
