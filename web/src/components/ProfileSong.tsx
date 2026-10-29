"use client";

import { useEffect, useRef, useState } from "react";

// Profilde arkada kısık sesle hep çalan YouTube şarkısı; köşede sadece adı yazar, durdurulamaz.
// Tarayıcılar, ziyaretçi sayfaya hiç dokunmadan sesli oynatmaya izin vermez: şarkı sessiz başlar,
// ziyaretçinin ilk tıklamasında / tuşunda ses açılır. Siteden linkle gelenlerde ses hemen açıktır.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global { interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void } }

let api: Promise<any> | null = null;
function loadYouTube(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  api ??= new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return api;
}

export function youtubeId(url?: string | null) {
  try {
    const u = new URL(url || "");
    if (u.hostname === "youtu.be") return u.pathname.slice(1, 12);
    if (/(^|\.)youtube\.com$/.test(u.hostname)) return u.searchParams.get("v") || u.pathname.match(/\/(embed|shorts|live)\/([\w-]{11})/)?.[2] || null;
  } catch { /* link değil */ }
  return null;
}

const GESTURES = ["pointerdown", "keydown", "touchstart"] as const;
// Ziyaretçinin seçtiği ses seviyesi bütün profillerde geçerli olsun diye tarayıcıda saklanır
const LEVEL_KEY = "ancalog.songVolume";
const savedLevel = () => { try { const v = localStorage.getItem(LEVEL_KEY); return v === null ? null : Number(v); } catch { return null; } };

export function ProfileSong({ url, title, volume }: { url: string; title?: string | null; volume?: number | null }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<any>(null);
  const [state, setState] = useState<"loading" | "ready" | "playing" | "error">("loading");
  // Telefon: iPhone ve çoğu telefon görünmeyen videoyu çalmaz, sesi de sayfadaki dokunuşla açtırmaz.
  // Orada şarkının küçük kapağı düğmenin ta kendisi olur: dokununca YouTube'un kendisi sesli çalar.
  const [touch] = useState(() => typeof window !== "undefined" && matchMedia("(hover: none)").matches);
  const id = youtubeId(url);
  const vol = Math.min(100, Math.max(1, volume || 15)); // profil sahibinin seçtiği ses
  const [level, setLevel] = useState(() => savedLevel() ?? vol); // ziyaretçinin ayarladığı ses
  const levelRef = useRef(level);
  const lastLevel = useRef(level || vol); // sessize alıp geri açınca dönülecek ses

  useEffect(() => {
    if (!id || !host.current) return;
    let dead = false, ready = false;
    const target = document.createElement("div"); // YouTube bu kutuyu kendi iframe'iyle değiştirir; React'in kutusu bozulmasın
    host.current.appendChild(target);

    const loud = () => { const p = player.current; p.unMute(); p.setVolume(levelRef.current); p.playVideo(); };
    // Ziyaretçinin ilk dokunuşunda sesi aç
    const onGesture = () => {
      if (!ready) return; // çalar hazır değilse bir sonraki dokunuşu bekle
      loud();
      GESTURES.forEach((g) => document.removeEventListener(g, onGesture, true));
    };
    if (!touch) GESTURES.forEach((g) => document.addEventListener(g, onGesture, true));

    loadYouTube().then((YT) => {
      if (dead) return;
      player.current = new YT.Player(target, {
        videoId: id, width: 200, height: 200, host: "https://www.youtube-nocookie.com",
        // Sessiz otomatik oynatmaya her tarayıcı izin verir
        playerVars: touch
          ? { autoplay: 0, mute: 0, loop: 1, playlist: id, controls: 0, disablekb: 1, playsinline: 1, rel: 0 }
          : { autoplay: 1, mute: 1, loop: 1, playlist: id, controls: 0, disablekb: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: () => {
            ready = true;
            player.current.setVolume(levelRef.current);
            if (touch) return setState("ready"); // telefonda ziyaretçinin dokunmasını bekle
            player.current.playVideo();
            if (navigator.userActivation?.hasBeenActive) onGesture(); // siteden tıklayıp geldiyse ses hemen açık
          },
          // Hep çalsın: herhangi bir sebeple durursa yeniden başlat
          onStateChange: (e: any) => {
            if (dead) return;
            if (e.data === 1) setState("playing");
            else if (e.data === 0) { player.current.seekTo(0, true); player.current.playVideo(); } // bitince başa sar, döngüde çalsın
            else if (e.data === 2 || e.data === 5) player.current.playVideo();
          },
          onError: () => { if (!dead) setState("error"); },
        },
      });
    });
    return () => {
      dead = true;
      GESTURES.forEach((g) => document.removeEventListener(g, onGesture, true));
      player.current?.destroy?.();
      player.current = null;
      target.remove();
    };
  }, [id, touch]);

  function changeLevel(v: number) {
    setLevel(v);
    levelRef.current = v;
    if (v) lastLevel.current = v;
    try { localStorage.setItem(LEVEL_KEY, String(v)); } catch { /* yok say */ }
    const p = player.current;
    if (!p?.setVolume) return;
    p.setVolume(v);
    if (v) p.unMute();
  }

  if (!id || state === "error") return null;

  return (
    <div className={`song ${state} ${touch ? "touch" : ""}`}>
      <div className="song-frame" ref={host} aria-hidden="true" />
      <span className="song-play">{state === "playing" ? <span className="eq"><i /><i /><i /></span> : touch && state === "ready" ? "▶" : ""}</span>
      <div className="song-text">
        <small>{state === "playing" ? "Şu an çalıyor" : touch && state === "ready" ? "Dinlemek için kapağa dokun" : "Profil şarkısı"}</small>
        <b title={title || ""}>{title || "Profil şarkısı"}</b>
      </div>
      <div className="song-vol">
        <button onClick={() => changeLevel(level ? 0 : lastLevel.current)} aria-label={level ? "Sessize al" : "Sesi aç"} title={level ? "Sessize al" : "Sesi aç"}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            {level ? <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              : <path d="M16 9l6 6m0-6l-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
          </svg>
        </button>
        <input type="range" min={0} max={100} value={level} onChange={(e) => changeLevel(Number(e.target.value))} aria-label="Ses seviyesi" />
      </div>
    </div>
  );
}
