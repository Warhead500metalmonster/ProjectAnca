"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Entry, Profile, RawgGame } from "@/lib/types";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { EntryForm } from "./EntryForm";
import { EntryView } from "./EntryView";

interface Ctx {
  me: Profile | null;
  setMe: (p: Profile) => void;
  following: Set<string>;
  ready: boolean;
  version: number; // sayfalar bunu izleyip veriyi yeniden çeker
  refresh: () => void;
  toast: (msg: string) => void;
  toggleFollow: (id: string) => Promise<void>;
  openForm: (entry?: Entry | null, opts?: { game?: RawgGame | null; type?: Entry["type"] }) => void;
  openView: (entry: Entry) => void;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("AppProvider eksik");
  return c;
};

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [me, setMe] = useState<Profile | null>(null);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(!supabaseConfigured());
  const [version, setVersion] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [form, setForm] = useState<{ entry: Entry | null; game: RawgGame | null; type?: Entry["type"] } | null>(null);
  const [viewing, setViewing] = useState<Entry | null>(null);
  const userId = useRef<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2600);
  }, []);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!supabaseConfigured()) return;
    const client = sb();

    async function loadMe(id: string | null) {
      userId.current = id;
      setMe(null);
      setFollowing(new Set());
      if (!id) return;
      const profile = await q<Profile | null>(client.from("profiles").select("*").eq("id", id).maybeSingle());
      const f = await q<{ following_id: string }[]>(client.from("follows").select("following_id").eq("follower_id", id));
      setMe(profile);
      setFollowing(new Set(f.map((r) => r.following_id)));
    }

    client.auth.getSession()
      .then(({ data }) => loadMe(data.session?.user.id ?? null))
      .catch(console.error)
      .finally(() => setReady(true));

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      const id = session?.user.id ?? null;
      if (id === userId.current) return;
      // Supabase, bu callback içinde doğrudan başka Supabase çağrısı yapılmasını önermiyor
      setTimeout(async () => {
        await loadMe(id).catch(console.error);
        const path = location.pathname;
        if (id && ["/login", "/signup"].includes(path)) router.replace("/");
        else if (!id && path === "/settings") router.replace("/");
        else refresh();
      });
    });
    return () => sub.subscription.unsubscribe();
  }, [router, refresh]);

  const toggleFollow = useCallback(async (id: string) => {
    if (!me) return;
    const on = following.has(id);
    try {
      if (on) await q(sb().from("follows").delete().eq("follower_id", me.id).eq("following_id", id));
      else await q(sb().from("follows").insert({ follower_id: me.id, following_id: id }));
      setFollowing((s) => { const n = new Set(s); if (on) n.delete(id); else n.add(id); return n; });
      refresh();
    } catch (err) {
      toast("Olmadı: " + (err as Error).message);
    }
  }, [me, following, refresh, toast]);

  const openForm: Ctx["openForm"] = useCallback((entry = null, opts = {}) => {
    if (!me) return router.push("/login");
    setForm({ entry, game: opts.game ?? null, type: opts.type });
  }, [me, router]);

  const value: Ctx = { me, setMe, following, ready, version, refresh, toast, toggleFollow, openForm, openView: setViewing };

  return (
    <AppCtx.Provider value={value}>
      {children}
      {form && <EntryForm {...form} onClose={() => setForm(null)} />}
      {viewing && <EntryView entry={viewing} onClose={() => setViewing(null)} onEdit={(e) => { setViewing(null); openForm(e); }} />}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </AppCtx.Provider>
  );
}
