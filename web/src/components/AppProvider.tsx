"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Entry, Item, Profile, RawgGame } from "@/lib/types";
import { BADGES } from "@/lib/constants";
import { contentKey } from "@/lib/format";
import { fetchEntries, friendsOnMyPlans } from "@/lib/data";
import { applyTheme } from "@/lib/theme";
import { countOf, q, sb, supabaseConfigured } from "@/lib/supabase";
import { EntryForm } from "./EntryForm";
import { EntryView } from "./EntryView";
import { ListPicker } from "./ListPicker";

interface FormOpts { game?: RawgGame | null; type?: Entry["type"]; item?: Item | null }

interface Ctx {
  me: Profile | null;
  setMe: (p: Profile) => void;
  following: Set<string>;
  followers: Set<string>;   // beni takip edenler; karşılıklıysa arkadaşız, mesajlaşabiliriz
  isFriend: (id: string) => boolean;
  mine: Entry[];            // kendi kayıtlarım: başkalarının puanlarıyla karşılaştırmak için
  myEntry: (x: Item) => Entry | undefined;
  badges: Map<string, string[]>;
  loadBadges: () => void;
  isAdmin: boolean;         // site sahibi ya da yönetici: içerik sayfalarını düzenler, yönetim paneline girer
  isOwner: boolean;
  scale: 5 | 10;            // puanların gösterildiği ölçek
  unread: number;
  notifAt: string;          // en yeni bildirimin zamanı
  ready: boolean;
  version: number;          // sayfalar bunu izleyip veriyi yeniden çeker
  refresh: () => void;
  checkInbox: () => void;
  toast: (msg: string) => void;
  toggleFollow: (id: string) => Promise<void>;
  openForm: (entry?: Entry | null, opts?: FormOpts) => void;
  openView: (entry: Entry) => void;
  pickList: (item: Item) => void;
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
  const [followers, setFollowers] = useState<Set<string>>(new Set());
  const [mine, setMine] = useState<Entry[]>([]);
  const [badges, setBadges] = useState<Map<string, string[]>>(new Map());
  const [unread, setUnread] = useState(0);
  const [notifAt, setNotifAt] = useState("");
  const [ready, setReady] = useState(!supabaseConfigured());
  const [version, setVersion] = useState(0);
  const [toastMsg, setToastMsg] = useState("");
  const [form, setForm] = useState<{ entry: Entry | null; opts: FormOpts } | null>(null);
  const [viewing, setViewing] = useState<Entry | null>(null);
  const [picking, setPicking] = useState<Item | null>(null);
  const userId = useRef<string | null>(null);
  const plansRef = useRef<{ following: string[]; mine: Entry[] }>({ following: [], mine: [] }); // akıllı bildirim için
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2600);
  }, []);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const myBadgesRef = useRef<string[] | null>(null); // yeni kazanılan rozeti haber vermek için
  const loadBadges = useCallback(() => {
    q<{ user_id: string; badge: string }[]>(sb().from("user_badges").select("user_id, badge").order("granted_at"))
      .then((rows) => {
        const m = new Map<string, string[]>();
        const order = Object.keys(BADGES); // her zaman önce
        for (const r of rows) m.set(r.user_id, [...(m.get(r.user_id) || []), r.badge].sort((x, y) => order.indexOf(x) - order.indexOf(y)));
        setBadges(m);
        const id = userId.current;
        if (!id) return;
        const now = m.get(id) || [];
        const fresh = myBadgesRef.current ? now.filter((b) => !myBadgesRef.current!.includes(b) && BADGES[b]) : [];
        myBadgesRef.current = now;
        if (fresh.length) toast(`Yeni rozet kazandın: ${fresh.map((b) => BADGES[b].name).join(", ")}!`);
      })
      .catch(() => {});
  }, [toast]);

  // Okunmamış mesaj sayısı ve en yeni bildirim (beğeni, yorum, takip) zamanı
  // Okunmamış mesaj varsa sekme başlığında da görünsün: "(2) Ancalog".
  // Sayfa değişince Next başlığı yeniden yazar; birkaç saniyede bir kontrol edip sayıyı geri ekler.
  // (Başlığı izleyip anında yazmak sonsuz döngüye girebiliyordu, bu yüzden basit bir zamanlayıcı.)
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(/^\(\d+\+?\)\s*/, "").trim() || "Ancalog";
      const want = unread > 0 ? `(${unread > 99 ? "99+" : unread}) ${base}` : base;
      if (document.title.trim() !== want) document.title = want;
    };
    apply();
    const t = setInterval(apply, 2000);
    return () => clearInterval(t);
  }, [unread]);

  const checkInbox = useCallback(async () => {
    const id = userId.current;
    if (!id) return;
    const db = sb();
    try {
      const [count, like, comment, follow, plans] = await Promise.all([
        countOf(db.from("messages").select("id", { count: "exact", head: true }).eq("receiver_id", id).is("read_at", null)),
        q<{ created_at: string }[]>(db.from("likes").select("created_at, entries!inner(user_id)").eq("entries.user_id", id).neq("user_id", id).order("created_at", { ascending: false }).limit(1)),
        q<{ created_at: string }[]>(db.from("comments").select("created_at, entries!inner(user_id)").eq("entries.user_id", id).neq("user_id", id).order("created_at", { ascending: false }).limit(1)),
        q<{ created_at: string }[]>(db.from("follows").select("created_at").eq("following_id", id).order("created_at", { ascending: false }).limit(1)),
        friendsOnMyPlans(plansRef.current.following, plansRef.current.mine).catch(() => [] as Entry[]),
      ]);
      if (userId.current !== id) return;
      setUnread(count);
      setNotifAt([like[0]?.created_at, comment[0]?.created_at, follow[0]?.created_at, plans[0]?.updated_at].map((x) => x || "").sort().pop() || "");
    } catch { /* bir sonraki denemede */ }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured()) return;
    const client = sb();

    async function loadMe(id: string | null) {
      userId.current = id;
      setMe(null);
      setFollowing(new Set());
      setFollowers(new Set());
      setMine([]);
      setUnread(0);
      if (!id) return;
      const [profile, f, fr, entries] = await Promise.all([
        q<Profile | null>(client.from("profiles").select("*").eq("id", id).maybeSingle()),
        q<{ following_id: string }[]>(client.from("follows").select("following_id").eq("follower_id", id)),
        q<{ follower_id: string }[]>(client.from("follows").select("follower_id").eq("following_id", id)),
        fetchEntries(id),
      ]);
      if (userId.current !== id) return;
      setMe(profile);
      setFollowing(new Set(f.map((r) => r.following_id)));
      setFollowers(new Set(fr.map((r) => r.follower_id)));
      setMine(entries);
      checkInbox();
    }

    loadBadges();
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
        else if (!id && ["/settings", "/notifications"].includes(path)) router.replace("/");
        else refresh();
      });
    });
    // Yeni mesaj sayısı çabuk görünsün: sık yokla, sekmeye geri dönünce hemen bak
    const timer = setInterval(() => { if (document.visibilityState === "visible") checkInbox(); }, 10000);
    const onShow = () => { if (document.visibilityState === "visible") checkInbox(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { sub.subscription.unsubscribe(); clearInterval(timer); document.removeEventListener("visibilitychange", onShow); };
  }, [router, refresh, checkInbox, loadBadges]);

  useEffect(() => { plansRef.current = { following: [...following], mine }; }, [following, mine]);

  // Kişisel site rengi (çıkış yapınca varsayılana döner)
  useEffect(() => { if (ready) applyTheme(me?.site_color); }, [ready, me?.site_color]);

  // Kayıt ekleyip değiştirdikçe rozetleri tazele (veritabanı hak edilen rozeti hemen verir)
  useEffect(() => {
    if (version) loadBadges();
    if (!me) myBadgesRef.current = null;
  }, [version, me, loadBadges]);

  // Kayıt eklenip silindikçe kendi kütüphanemi tazele
  useEffect(() => {
    if (version && userId.current) fetchEntries(userId.current).then(setMine).catch(() => {});
  }, [version]);

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
    setForm({ entry, opts });
  }, [me, router]);

  const pickList = useCallback((item: Item) => {
    if (!me) return router.push("/login");
    setPicking(item);
  }, [me, router]);

  const myEntry = useCallback((x: Item) => {
    const k = contentKey(x);
    return mine.find((e) => contentKey(e) === k);
  }, [mine]);

  const myBadges = (me && badges.get(me.id)) || [];
  const value: Ctx = {
    me, setMe, following, followers, isFriend: (id) => following.has(id) && followers.has(id),
    mine, myEntry, badges, loadBadges, isOwner: myBadges.includes("owner"), isAdmin: myBadges.some((b) => b === "owner" || b === "admin"), scale: me?.rating_scale === 10 ? 10 : 5, unread, notifAt,
    ready, version, refresh, checkInbox, toast, toggleFollow, openForm, openView: setViewing, pickList,
  };

  return (
    <AppCtx.Provider value={value}>
      {children}
      {form && <EntryForm entry={form.entry} {...form.opts} onClose={() => setForm(null)} />}
      {viewing && <EntryView entry={viewing} onClose={() => setViewing(null)} onEdit={(e) => { setViewing(null); openForm(e); }} />}
      {picking && <ListPicker item={picking} onClose={() => setPicking(null)} />}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </AppCtx.Provider>
  );
}
