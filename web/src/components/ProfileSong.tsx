"use client";

import { useEffect, useRef, useState } from "react";

// Profilde arkada kısık sesle çalan YouTube şarkısı ve köşedeki küçük çalar.
// Tarayıcılar, ziyaretçi sayfaya hiç tıklamadan sesli oynatmaya izin vermeyebilir: o zaman ilk tıklamada başlar.

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

export function ProfileSong({ url, title, volume }: { url: string; title?: string | null; volume?: number | null }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<any>(null);
  const userPaused = useRef(false);
  const [state, setState] = useState<"loading" | "playing" | "paused" | "error">("loading");
  const [muted, setMuted] = useState(false);
  const id = youtubeId(url);
  const vol = Math.min(100, Math.max(1, volume || 15));

  useEffect(() => {
    if (!id || !host.current) return;
    let dead = false;
    const target = document.createElement("div"); // YouTube bu kutuyu kendi iframe'iyle değiştirir; React'in kutusu bozulmasın
    host.current.appendChild(target);
    // Otomatik başlayamadıysa ziyaretçinin sayfadaki ilk tıklamasında başlat
    const kick = () => { if (!userPaused.current) player.current?.playVideo?.(); };
    document.addEventListener("pointerdown", kick, { once: true });

    loadYouTube().then((YT) => {
      if (dead) return;
      player.current = new YT.Player(target, {
        videoId: id, width: 200, height: 200,
        playerVars: { autoplay: 1, loop: 1, playlist: id, controls: 0, playsinline: 1, rel: 0 },
        events: {
          onReady: (e: any) => { e.target.setVolume(vol); e.target.playVideo(); },
          onStateChange: (e: any) => { if (!dead) setState(e.data === 1 ? "playing" : e.data === 3 ? "loading" : "paused"); },
          onError: () => { if (!dead) setState("error"); },
        },
      });
    });
    return () => {
      dead = true;
      document.removeEventListener("pointerdown", kick);
      player.current?.destroy?.();
      player.current = null;
      target.remove();
    };
  }, [id, vol]);

  if (!id) return null;

  function toggle() {
    const p = player.current;
    if (!p) return;
    if (state === "playing") { userPaused.current = true; p.pauseVideo(); }
    else { userPaused.current = false; p.setVolume(vol); p.playVideo(); }
  }
  function toggleMute() {
    const p = player.current;
    if (!p) return;
    if (muted) p.unMute(); else p.mute();
    setMuted(!muted);
  }

  return (
    <div className={`song ${state}`} onPointerDown={(e) => e.stopPropagation()}>
      <div className="song-frame" ref={host} aria-hidden="true" />
      <button className="song-play" onClick={toggle} aria-label={state === "playing" ? "Durdur" : "Çal"} disabled={state === "error"}>
        {state === "playing" ? <span className="eq"><i /><i /><i /></span> : "▶"}
      </button>
      <div className="song-text">
        <small>{state === "error" ? "Şarkı çalınamıyor" : state === "playing" ? "Şu an çalıyor" : "Profil şarkısı · çalmak için bas"}</small>
        <b title={title || ""}>{title || "Profil şarkısı"}</b>
      </div>
      {state === "playing" && <button className="song-mute" onClick={toggleMute} aria-label={muted ? "Sesi aç" : "Sesi kapat"}>{muted ? "🔇" : "🔉"}</button>}
    </div>
  );
}
