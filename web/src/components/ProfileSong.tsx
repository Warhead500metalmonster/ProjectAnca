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

export function ProfileSong({ url, title, volume }: { url: string; title?: string | null; volume?: number | null }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "playing" | "error">("loading");
  const id = youtubeId(url);
  const vol = Math.min(100, Math.max(1, volume || 15));

  useEffect(() => {
    if (!id || !host.current) return;
    let dead = false, player: any = null, ready = false;
    const target = document.createElement("div"); // YouTube bu kutuyu kendi iframe'iyle değiştirir; React'in kutusu bozulmasın
    host.current.appendChild(target);

    const loud = () => { player.unMute(); player.setVolume(vol); player.playVideo(); };
    // Ziyaretçinin ilk dokunuşunda sesi aç
    const onGesture = () => {
      if (!ready) return; // çalar hazır değilse bir sonraki dokunuşu bekle
      loud();
      GESTURES.forEach((g) => document.removeEventListener(g, onGesture, true));
    };
    GESTURES.forEach((g) => document.addEventListener(g, onGesture, true));

    loadYouTube().then((YT) => {
      if (dead) return;
      player = new YT.Player(target, {
        videoId: id, width: 200, height: 200,
        // Sessiz otomatik oynatmaya her tarayıcı izin verir
        playerVars: { autoplay: 1, mute: 1, loop: 1, playlist: id, controls: 0, disablekb: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: () => {
            ready = true;
            player.setVolume(vol);
            player.playVideo();
            if (navigator.userActivation?.hasBeenActive) onGesture(); // siteden tıklayıp geldiyse ses hemen açık
          },
          // Hep çalsın: herhangi bir sebeple durursa yeniden başlat
          onStateChange: (e: any) => {
            if (dead) return;
            if (e.data === 1) setState("playing");
            else if (e.data === 2 || e.data === 0 || e.data === 5) player.playVideo();
          },
          onError: () => { if (!dead) setState("error"); },
        },
      });
    });
    return () => {
      dead = true;
      GESTURES.forEach((g) => document.removeEventListener(g, onGesture, true));
      player?.destroy?.();
      target.remove();
    };
  }, [id, vol]);

  if (!id || state === "error") return null;

  return (
    <div className={`song ${state}`}>
      <div className="song-frame" ref={host} aria-hidden="true" />
      <span className="song-play">{state === "playing" ? <span className="eq"><i /><i /><i /></span> : "♪"}</span>
      <div className="song-text">
        <small>{state === "playing" ? "Şu an çalıyor" : "Profil şarkısı"}</small>
        <b title={title || ""}>{title || "Profil şarkısı"}</b>
      </div>
    </div>
  );
}
