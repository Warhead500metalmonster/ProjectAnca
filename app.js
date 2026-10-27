// Ancalog: oyun, film, dizi, müzik ve anime günlüğü. Veriler localStorage'da tutulur.

const TYPES = {
  game:  { label: "Oyun",  icon: "🎮", creator: "Geliştirici",       active: "Oynuyorum" },
  movie: { label: "Film",  icon: "🎬", creator: "Yönetmen",          active: "İzliyorum" },
  show:  { label: "Dizi",  icon: "📺", creator: "Yaratıcı / Kanal",  active: "İzliyorum" },
  music: { label: "Müzik", icon: "🎵", creator: "Sanatçı",           active: "Dinliyorum", square: true },
  anime: { label: "Anime", icon: "🌸", creator: "Stüdyo",            active: "İzliyorum" },
};

const STATUSES = ["completed", "active", "planned", "paused", "dropped"];
const statusLabel = (s, type) => ({
  completed: "Bitti",
  active: type ? TYPES[type].active : "Devam ediyor",
  planned: "Planlandı",
  paused: "Ara verdim",
  dropped: "Bıraktım",
})[s];

const STORAGE_KEY = "ancalog.v1";
const $ = (id) => document.getElementById(id);

let items = load();
let view = { type: "all", status: "all", sort: "updated", q: "" };
let editing = null;   // düzenlenen kaydın id'si
let formType = "game";
let formRating = 0;   // 0-10 (yarım yıldız = 1 puan)

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
  catch { alert("Kaydedilemedi: tarayıcı depolaması kullanılamıyor."); }
}

function today() {
  const d = new Date();
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function starsHtml(r) {
  let out = "";
  for (let i = 1; i <= 5; i++) {
    const v = r - (i - 1) * 2;
    out += `<span class="star ${v >= 2 ? "full" : v === 1 ? "half" : ""}" data-i="${i}">★</span>`;
  }
  return out;
}

// ---------- Render ----------

function render() {
  renderTabs();
  renderStats();
  renderStatusFilter();
  renderGrid();
}

function renderTabs() {
  const tabs = [["all", "✨", "Tümü"], ...Object.entries(TYPES).map(([k, t]) => [k, t.icon, t.label])];
  $("tabs").innerHTML = tabs.map(([k, icon, label]) => {
    const n = k === "all" ? items.length : items.filter((i) => i.type === k).length;
    return `<button class="tab ${view.type === k ? "active" : ""}" data-type="${k}">${icon} ${label}<span class="count">${n}</span></button>`;
  }).join("");
}

function scoped() {
  return view.type === "all" ? items : items.filter((i) => i.type === view.type);
}

function renderStats() {
  const list = scoped();
  const rated = list.filter((i) => i.rating > 0);
  const avg = rated.length ? (rated.reduce((s, i) => s + i.rating, 0) / rated.length / 2).toFixed(1) : "–";
  const year = new Date().getFullYear().toString();
  const thisYear = list.filter((i) => i.status === "completed" && (i.date || "").startsWith(year)).length;
  const stats = [
    [list.length, "Toplam kayıt"],
    [list.filter((i) => i.status === "completed").length, "Bitirilen"],
    [list.filter((i) => i.status === "active").length, "Devam eden"],
    [thisYear, `${year}'te bitirilen`],
    [avg === "–" ? avg : `${avg} ★`, "Ortalama puan"],
  ];
  $("stats").innerHTML = stats.map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("");
}

function renderStatusFilter() {
  const type = view.type === "all" ? null : view.type;
  const chips = [["all", "Hepsi"], ...STATUSES.map((s) => [s, statusLabel(s, type)])];
  $("statusFilter").innerHTML = chips.map(([k, label]) =>
    `<button class="chip ${view.status === k ? "active" : ""}" data-status="${k}">${label}</button>`).join("");
}

function renderGrid() {
  const q = view.q.trim().toLocaleLowerCase("tr");
  let list = scoped().filter((i) =>
    (view.status === "all" || i.status === view.status) &&
    (!q || `${i.title} ${i.creator} ${i.notes}`.toLocaleLowerCase("tr").includes(q)));

  const sorters = {
    updated: (a, b) => b.updated - a.updated,
    rating: (a, b) => b.rating - a.rating || b.updated - a.updated,
    title: (a, b) => a.title.localeCompare(b.title, "tr"),
    year: (a, b) => (b.year || 0) - (a.year || 0),
  };
  list = [...list].sort(sorters[view.sort]);

  $("grid").innerHTML = list.map((i) => {
    const t = TYPES[i.type];
    const sq = t.square ? "square" : "";
    const cover = i.cover
      ? `<img class="cover ${sq}" src="${esc(i.cover)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;cover ${sq} placeholder&quot;>${t.icon}</div>'">`
      : `<div class="cover ${sq} placeholder">${t.icon}</div>`;
    const meta = [i.creator, i.year].filter(Boolean).join(" · ");
    return `<button class="card" data-id="${i.id}">
      ${cover}
      <div class="card-body">
        <div class="card-title">${esc(i.title)}</div>
        ${meta ? `<div class="card-meta">${esc(meta)}</div>` : ""}
        ${i.rating ? `<div class="stars">${starsHtml(i.rating)}</div>` : ""}
        <span class="badge ${i.status}">${view.type === "all" ? t.icon + " " : ""}${statusLabel(i.status, i.type)}</span>
      </div>
    </button>`;
  }).join("");

  const empty = $("empty");
  empty.hidden = list.length > 0;
  empty.textContent = items.length
    ? "Bu filtreye uyan kayıt yok."
    : "Henüz hiçbir şey loglamadın. Sağ üstteki “+ Ekle” ile başla!";
}

// ---------- Form ----------

function renderTypePicker() {
  $("typePicker").innerHTML = Object.entries(TYPES).map(([k, t]) =>
    `<button type="button" data-type="${k}" class="${formType === k ? "active" : ""}">${t.icon} ${t.label}</button>`).join("");
  $("creatorLabel").textContent = TYPES[formType].creator;
  const cur = $("f-status").value || "completed";
  $("f-status").innerHTML = STATUSES.map((s) =>
    `<option value="${s}">${statusLabel(s, formType)}</option>`).join("");
  $("f-status").value = cur;
}

function renderStarInput() {
  $("stars").innerHTML = starsHtml(formRating) + `<button type="button" class="link clear">temizle</button>`;
  $("ratingText").textContent = formRating ? `(${formRating / 2} / 5)` : "";
}

function openForm(item) {
  editing = item ? item.id : null;
  formType = item ? item.type : (view.type === "all" ? "game" : view.type);
  formRating = item ? item.rating : 0;
  $("formTitle").textContent = item ? "Kaydı düzenle" : "Yeni kayıt";
  $("f-title").value = item?.title || "";
  $("f-year").value = item?.year || "";
  $("f-creator").value = item?.creator || "";
  $("f-date").value = item?.date || today();
  $("f-cover").value = item?.cover || "";
  $("f-notes").value = item?.notes || "";
  $("f-status").value = "";
  renderTypePicker();
  $("f-status").value = item?.status || "completed";
  renderStarInput();
  $("deleteBtn").hidden = !item;
  $("dialog").showModal();
  $("f-title").focus();
}

function submitForm(e) {
  e.preventDefault();
  const data = {
    type: formType,
    title: $("f-title").value.trim(),
    year: parseInt($("f-year").value) || null,
    creator: $("f-creator").value.trim(),
    status: $("f-status").value,
    date: $("f-date").value,
    rating: formRating,
    cover: $("f-cover").value.trim(),
    notes: $("f-notes").value.trim(),
    updated: Date.now(),
  };
  if (!data.title) return;
  if (editing) {
    Object.assign(items.find((i) => i.id === editing), data);
  } else {
    items.push({ id: crypto.randomUUID?.() || String(Date.now() + Math.random()), ...data });
  }
  save();
  $("dialog").close();
  render();
}

// ---------- Events ----------

$("tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-type]");
  if (!b) return;
  view.type = b.dataset.type;
  view.status = "all";
  render();
});

$("statusFilter").addEventListener("click", (e) => {
  const b = e.target.closest("[data-status]");
  if (!b) return;
  view.status = b.dataset.status;
  renderStatusFilter();
  renderGrid();
});

$("sort").addEventListener("change", (e) => { view.sort = e.target.value; renderGrid(); });
$("search").addEventListener("input", (e) => { view.q = e.target.value; renderGrid(); });

$("grid").addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (card) openForm(items.find((i) => i.id === card.dataset.id));
});

$("addBtn").addEventListener("click", () => openForm(null));
$("cancelBtn").addEventListener("click", () => $("dialog").close());
$("form").addEventListener("submit", submitForm);

$("typePicker").addEventListener("click", (e) => {
  const b = e.target.closest("[data-type]");
  if (!b) return;
  formType = b.dataset.type;
  renderTypePicker();
});

$("stars").addEventListener("click", (e) => {
  if (e.target.closest(".clear")) { formRating = 0; renderStarInput(); return; }
  const s = e.target.closest(".star");
  if (!s) return;
  const leftHalf = e.offsetX < s.offsetWidth / 2;
  formRating = s.dataset.i * 2 - (leftHalf ? 1 : 0);
  renderStarInput();
});

$("deleteBtn").addEventListener("click", () => {
  const item = items.find((i) => i.id === editing);
  if (!item || !confirm(`“${item.title}” silinsin mi?`)) return;
  items = items.filter((i) => i.id !== editing);
  save();
  $("dialog").close();
  render();
});

$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ancalog-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error();
    const valid = data.filter((i) => i && i.id && i.title && TYPES[i.type]);
    const byId = new Map(items.map((i) => [i.id, i]));
    valid.forEach((i) => byId.set(i.id, i));
    items = [...byId.values()];
    save();
    render();
    alert(`${valid.length} kayıt içe aktarıldı.`);
  } catch {
    alert("Dosya okunamadı. Ancalog'dan dışa aktarılmış bir JSON seç.");
  }
  e.target.value = "";
});

document.addEventListener("keydown", (e) => {
  if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA" && !$("dialog").open) {
    e.preventDefault();
    $("search").focus();
  }
});

render();
