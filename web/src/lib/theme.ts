// Kişisel site rengi: sadece seçen kişinin ekranında sitenin vurgu rengini değiştirir.
// Sayfa açılırken renk yanıp sönmesin diye tarayıcıda da saklanır (layout.tsx'teki küçük betik okur).
export const THEME_KEY = "ancalog.theme";
export const DEFAULT_COLOR = "#58a98a";

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

export function applyTheme(color?: string | null) {
  const root = document.documentElement.style;
  if (!color || !/^#[0-9a-f]{6}$/i.test(color) || color.toLowerCase() === DEFAULT_COLOR) {
    for (const k of ["--accent", "--accent-2", "--accent-rgb"]) root.removeProperty(k);
    try { localStorage.removeItem(THEME_KEY); } catch { /* yok say */ }
    return;
  }
  const [r, g, b] = hex(color);
  const light = [r, g, b].map((x) => Math.round(x + (255 - x) * 0.45)); // yazılar için açık tonu
  root.setProperty("--accent", color);
  root.setProperty("--accent-2", `rgb(${light.join(" ")})`);
  root.setProperty("--accent-rgb", `${r} ${g} ${b}`);
  try { localStorage.setItem(THEME_KEY, color); } catch { /* yok say */ }
}

// layout.tsx <head> içinde, sayfa çizilmeden önce çalışır
export const themeBootScript = `try{var c=localStorage.getItem("${THEME_KEY}");if(/^#[0-9a-f]{6}$/i.test(c)){var s=document.documentElement.style,n=[1,3,5].map(function(i){return parseInt(c.slice(i,i+2),16)});s.setProperty("--accent",c);s.setProperty("--accent-2","rgb("+n.map(function(x){return Math.round(x+(255-x)*.45)}).join(" ")+")");s.setProperty("--accent-rgb",n.join(" "))}}catch(e){}`;
