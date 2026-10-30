"use client";

import { useState } from "react";

// Şifre kutusu: yazdığını görmek isteyen "Göster"e basar
export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="pass-wrap">
      <input {...props} type={show ? "text" : "password"} />
      <button type="button" className="link pass-eye" aria-pressed={show} onClick={() => setShow(!show)}>{show ? "Gizle" : "Göster"}</button>
    </div>
  );
}
