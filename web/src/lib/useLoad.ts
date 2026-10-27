"use client";

import { useEffect, useState } from "react";

// Veriyi çeker; deps değişince (örn. giriş, kayıt eklendi) yeniden çeker.
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[], enabled = true) {
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  useEffect(() => {
    if (!enabled) return;
    let stale = false; // kullanıcı bu arada başka sayfaya geçtiyse sonucu yok say
    fn().then((data) => !stale && setState({ data }), (err) => !stale && setState({ error: (err as Error).message }));
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);
  return state;
}
