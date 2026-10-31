/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { safeUrl } from "@/lib/format";
import { useApp } from "./AppProvider";
import { RichText } from "./ui";

// Bütün sohbetlerin ortak parçaları (mesajlar, forum, yorumlar, etkinlik sohbeti): link ile fotoğraf ve yanıtlama

// Yazıdaki resim linklerini ayır: doğrudan resim dosyaları, Imgur ve Discord linkleri
const IMG_URL = /https:\/\/[^\s<>"]+?(?:\.(?:jpe?g|png|gif|webp|avif)(?:\?[^\s<>"]*)?|(?=\s|$))/gi;
export function imagesIn(body: string): { text: string; images: string[] } {
  const images: string[] = [];
  const text = body.replace(IMG_URL, (url) => {
    let u = url;
    const imgur = u.match(/^https:\/\/(?:www\.)?imgur\.com\/([A-Za-z0-9]{5,10})$/); // sayfa linki → resmin kendisi
    if (imgur) u = `https://i.imgur.com/${imgur[1]}.jpeg`;
    const isImg = /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(u) || /^https:\/\/(i\.imgur\.com|media\.discordapp\.net|cdn\.discordapp\.com)\//i.test(u);
    if (!isImg) return url;
    images.push(u);
    return "";
  }).trim();
  return { text, images };
}

// Fotoğraf açılmazsa boş kutu yerine linki göster
function PostImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return failed
    ? <a href={src} target="_blank" rel="noopener noreferrer nofollow" className="ev-img-broken">Fotoğraf açılamadı: {src}</a>
    : <a href={src} target="_blank" rel="noopener noreferrer nofollow" className="ev-post-img"><img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /></a>;
}

// Mesajın kendisi: yazı (spoilerlar gizli) ve içindeki fotoğraflar. image: eski etkinlik mesajlarının ayrı fotoğrafı
export function ChatBody({ text, image }: { text: string; image?: string | null }) {
  const { text: rest, images } = imagesIn(text);
  const all = [...new Set([...(image && safeUrl(image) ? [image] : []), ...images])];
  return (
    <>
      {rest && rest !== "📷" && <div className="chat-text"><RichText text={rest} /></div>}
      {all.map((src) => <PostImage key={src} src={src} />)}
    </>
  );
}

// Tek satırlık özet: sohbet listesi ve yanıt alıntısı için (spoiler açığa çıkmaz)
export function excerptOf(body: string, image?: string | null) {
  const { text, images } = imagesIn(body.replace(/\|\|[\s\S]*?\|\|/g, "[spoiler]"));
  const t = text === "📷" ? "" : text;
  return t.slice(0, 140) || (images.length || image ? "Fotoğraf" : "");
}

// Yazma kutusunun yanındaki düğme: linki yapıştır, yazıya eklensin; altında önizleme çıkar
export function PhotoAdd({ onAdd }: { onAdd: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const ok = /^https:\/\/\S+$/i.test(url.trim());
  function add() {
    if (!ok) return;
    onAdd(url.trim());
    setUrl("");
    setOpen(false);
  }
  return (
    <span className="photo-add">
      <button type="button" className={`btn ${open ? "on" : ""}`} aria-expanded={open} onClick={() => setOpen(!open)}>Fotoğraf</button>
      {open && (
        <span className="photo-add-in">
          <input className="input" type="url" autoFocus placeholder="Fotoğraf linkini yapıştır (https://…)" value={url} onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button type="button" className="btn" disabled={!ok} onClick={add}>Ekle</button>
        </span>
      )}
    </span>
  );
}
export const withPhoto = (text: string, url: string) => (text.trim() ? `${text.trimEnd()} ${url}` : url);

// Gönderilmeden önce, yazıdaki fotoğrafların küçük hali
export function DraftPhotos({ text }: { text: string }) {
  const { images } = imagesIn(text);
  if (!images.length) return null;
  return <div className="draft-photos">{images.map((src) => <img key={src} src={src} alt="Önizleme" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.display = "none")} />)}</div>;
}

export interface ReplyTarget { id: string; name: string; body: string; image?: string | null }

// Yazma kutusunun üstünde: kime yanıt veriyorsun, istersen vazgeç
export function ReplyingTo({ reply, onCancel }: { reply: ReplyTarget; onCancel: () => void }) {
  return (
    <div className="replying">
      <div className="grow">Yanıtlıyorsun: <b>{reply.name}</b><span>{excerptOf(reply.body, reply.image)}</span></div>
      <button type="button" className="icon-btn" aria-label="Yanıtlamaktan vazgeç" onClick={onCancel}>✕</button>
    </div>
  );
}

// Yanıtlanan mesaj: mesajın üstünde küçük alıntı, tıklayınca o mesaja gider
export function ReplyQuote({ parent, name }: { parent?: { id: string; user_id?: string; body: string; image?: string | null; spoiler?: boolean } | null; name?: string | null }) {
  const { blocked } = useApp();
  if (!parent) return <div className="reply-quote gone">Eski ya da silinmiş bir mesaja yanıt</div>;
  if (parent.user_id && blocked.has(parent.user_id)) return <div className="reply-quote gone">Engellediğin birine yanıt</div>;
  function jump() {
    const el = document.getElementById(`msg-${parent!.id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("msg-flash");
    setTimeout(() => el.classList.remove("msg-flash"), 1400);
  }
  return (
    <button type="button" className="reply-quote" onClick={jump} title="Yanıtlanan mesaja git">
      {name && <b>{name}</b>}
      <span>{parent.spoiler ? "Spoiler" : excerptOf(parent.body, parent.image)}</span>
    </button>
  );
}
