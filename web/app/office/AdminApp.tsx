"use client";
// Poccabet admin panel. One client app for every /office URL: log in with an admin account
// (the same login as the site), then Dashboard, Users, Bets, Matches and the Audit log.
// Everything goes through /api/admin (see backend/src/routes/admin.ts); every change asks for a reason.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

// ---------- API ----------
class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const token = () => (typeof window === "undefined" ? null : localStorage.getItem("token"));

async function api<T>(path: string, body?: unknown): Promise<T> {
  const t = token();
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.code ?? "", data.error ?? `Request failed (${res.status})`);
  return data as T;
}

// Load a GET endpoint; `reload` fetches it again (after an action).
function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    setError("");
    api<T>(path).then((d) => live && setData(d)).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [path, tick]);
  return { data, error, reload: useCallback(() => setTick((t) => t + 1), []) };
}

// ---------- formatting ----------
const naira = (v: number | null | undefined) => v == null ? "—" : `${v < 0 ? "-" : ""}₦${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (d: string | Date | null | undefined) => d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) : "—";
const day = (d: string | Date | null | undefined) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }) : "—";
const STATUS_TONE: Record<string, string> = { PENDING: "yellow", WON: "green", LOST: "red", VOID: "gray", CASHED_OUT: "blue" };
const Badge = ({ tone, children }: { tone: string; children: ReactNode }) => <span className={`adm-badge ${tone}`}>{children}</span>;

// ---------- shell ----------
const NAV = [
  { href: "/office", label: "Dashboard", icon: "M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z" },
  { href: "/office/users", label: "Users", icon: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0" },
  { href: "/office/bets", label: "Bets", icon: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6" },
  { href: "/office/reports", label: "Reports", icon: "M4 20V10M10 20V4M16 20v-8M22 20H2" },
  { href: "/office/matches", label: "Matches", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4 4 3-1.5 4.5h-5L8 10z" },
  { href: "/office/audit", label: "Audit log", icon: "M12 8v4l3 2M12 3a9 9 0 1 0 9 9" },
];

export function AdminApp() {
  const path = (usePathname() ?? "/office").split("/").filter(Boolean).slice(1);
  const [me, setMe] = useState<{ id: string; displayName: string; mode: string } | null>(null);
  const [state, setState] = useState<"loading" | "login" | "denied" | "ok">("loading");
  const [toast, setToast] = useState("");

  const check = useCallback(() => {
    if (!token()) return setState("login");
    setState("loading");
    api<{ id: string; displayName: string; mode: string }>("/admin/me")
      .then((m) => { setMe(m); setState("ok"); })
      .catch((e: ApiError) => setState(e.status === 401 ? "login" : "denied"));
  }, []);
  useEffect(check, [check]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2600); return () => clearTimeout(t); }, [toast]);

  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); setMe(null); setState("login"); };

  if (state === "loading") return <div className="adm"><p style={{ margin: "auto", color: "var(--label)" }}>Loading…</p></div>;
  if (state === "login") return <div className="adm"><Login onDone={check} /></div>;
  if (state === "denied") {
    return (
      <div className="adm">
        <div className="adm-login adm-card" style={{ textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Admins only</h1>
          <p style={{ margin: 0, color: "var(--muted)" }}>This account doesn't have admin access.</p>
          <button className="adm-btn" onClick={logout}>Log in with another account</button>
        </div>
      </div>
    );
  }

  const [section = "", id] = path;
  const flash = (msg: string) => setToast(msg);
  let page: ReactNode;
  if (section === "users" && id) page = <UserPage id={id} flash={flash} />;
  else if (section === "users") page = <UsersPage />;
  else if (section === "bets" && id) page = <BetPage id={id} flash={flash} />;
  else if (section === "bets") page = <BetsPage />;
  else if (section === "matches") page = <MatchesPage flash={flash} />;
  else if (section === "audit") page = <AuditPage />;
  else if (section === "reports") page = <ReportsPage />;
  else page = <Dashboard />;

  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-logo">Pocca<span>bet</span><small>ADMIN</small></div>
        {NAV.map((n) => {
          const on = n.href === "/office" ? !section : n.href === `/office/${section}`;
          return (
            <Link key={n.href} href={n.href} className={`adm-nav${on ? " on" : ""}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={n.icon} /></svg>
              {n.label}
            </Link>
          );
        })}
        <div className="adm-side-foot">
          <span>Signed in as <b style={{ color: "var(--text)" }}>{me?.displayName}</b></span>
          <Badge tone={me?.mode === "live" ? "green" : "yellow"}>{me?.mode === "live" ? "LIVE FEED" : "SIMULATION"}</Badge>
          <a href="/" style={{ color: "var(--muted)" }}>← View site</a>
          <button className="adm-btn sm" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="adm-main">{page}</main>
      {toast && <div className="adm-toast" role="status">{toast}</div>}
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const body = id.includes("@") ? { email: id.trim(), password } : { phone: id.trim(), password };
      const res = await api<{ token: string; user: unknown }>("/auth/login", body);
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="adm-login adm-card" onSubmit={submit}>
      <div className="adm-logo" style={{ padding: 0 }}>Pocca<span>bet</span><small>ADMIN</small></div>
      <label className="adm-field">Phone number or email
        <input className="adm-input" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" required />
      </label>
      <label className="adm-field">Password
        <input className="adm-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      {error && <div className="adm-error">{error}</div>}
      <button className="adm-btn primary" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
    </form>
  );
}

// ---------- shared pieces ----------
function Head({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="adm-head">
      <div><h1>{title}</h1>{sub && <div className="adm-sub">{sub}</div>}</div>
      {children && <div className="adm-actions">{children}</div>}
    </div>
  );
}

// Search box that keeps its value in the address (?q=), so results can be shared and survive back.
function useQueryState(key: string) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? "/office";
  const value = params?.get(key) ?? "";
  const set = (v: string) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (v) next.set(key, v); else next.delete(key);
    if (key !== "page") next.delete("page");
    router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`);
  };
  return [value, set] as const;
}

function SearchBox({ placeholder }: { placeholder: string }) {
  const [q, setQ] = useQueryState("q");
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); setQ(text.trim()); }} style={{ display: "flex", gap: 8 }}>
      <input className="adm-input" style={{ width: 300 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      <button className="adm-btn">Search</button>
    </form>
  );
}

function Pager({ total, pageSize }: { total: number; pageSize: number }) {
  const [p, setP] = useQueryState("page");
  const n = Number(p) || 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, color: "var(--label)", fontSize: 13 }}>
      <button className="adm-btn sm" disabled={n <= 0} onClick={() => setP(String(n - 1))}>← Prev</button>
      Page {n + 1} of {pages} · {total} total
      <button className="adm-btn sm" disabled={n + 1 >= pages} onClick={() => setP(String(n + 1))}>Next →</button>
    </div>
  );
}

function Tabs({ name, options }: { name: string; options: [string, string][] }) {
  const [v, set] = useQueryState(name);
  return (
    <div className="adm-tabs">
      {options.map(([value, label]) => <button key={value} className={`adm-tab${v === value ? " on" : ""}`} onClick={() => set(value)}>{label}</button>)}
    </div>
  );
}

function Loading({ error }: { error?: string }) {
  return <div className="adm-card adm-empty">{error ? <span className="adm-error">{error}</span> : "Loading…"}</div>;
}

// A confirm dialog that always asks for a reason (it goes in the audit log).
type DialogSpec = {
  title: string; text?: ReactNode; confirm: string; tone?: "primary" | "danger" | "good";
  fields?: (set: (k: string, v: string) => void, values: Record<string, string>) => ReactNode;
  run: (values: Record<string, string>) => Promise<string>;
};
function useDialog(onDone: (msg: string) => void) {
  const [spec, setSpec] = useState<DialogSpec | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const open = (s: DialogSpec) => { setSpec(s); setValues({}); setError(""); };
  const set = (k: string, v: string) => setValues((x) => ({ ...x, [k]: v }));
  const node = spec && (
    <div className="adm-overlay" onClick={() => !busy && setSpec(null)}>
      <form className="adm-dialog" role="dialog" aria-modal="true" aria-label={spec.title} onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true); setError("");
          try { const msg = await spec.run(values); setSpec(null); onDone(msg); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
        }}>
        <h3>{spec.title}</h3>
        {spec.text && <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>{spec.text}</div>}
        {spec.fields?.(set, values)}
        <label className="adm-field">Reason (saved in the audit log)
          <textarea className="adm-textarea" value={values.reason ?? ""} onChange={(e) => set("reason", e.target.value)} required minLength={3} autoFocus />
        </label>
        {error && <div className="adm-error">{error}</div>}
        <div className="adm-actions" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="adm-btn" onClick={() => setSpec(null)} disabled={busy}>Cancel</button>
          <button className={`adm-btn ${spec.tone ?? "primary"}`} disabled={busy}>{busy ? "Working…" : spec.confirm}</button>
        </div>
      </form>
    </div>
  );
  return { open, node };
}

// ---------- dashboard ----------
type Stats = {
  mode: string; users: { total: number; today: number; week: number; suspended: number };
  bets: { today: { count: number; stake: number }; week: { count: number; stake: number } };
  ggr: { today: number; week: number; all: number }; open: { count: number; stake: number; liability: number };
  playerBalances: number; bonusesPaid: number; byDay: { day: string; bets: number; stake: number }[];
};
function Stat({ k, v, s, tone }: { k: string; v: ReactNode; s?: ReactNode; tone?: string }) {
  return <div className="adm-card adm-stat"><div className="k">{k}</div><div className="v" style={tone ? { color: tone } : undefined}>{v}</div>{s && <div className="s">{s}</div>}</div>;
}
function Dashboard() {
  const { data: s, error, reload } = useApi<Stats>("/admin/stats");
  useEffect(() => { const t = setInterval(reload, 60_000); return () => clearInterval(t); }, [reload]);
  if (!s) return <><Head title="Dashboard" /><Loading error={error} /></>;
  const max = Math.max(1, ...s.byDay.map((d) => d.stake));
  const green = (v: number) => (v >= 0 ? "#5BD69A" : "#FF8A8E");
  return (
    <>
      <Head title="Dashboard" sub={<>Updated {when(new Date())} · {s.mode === "live" ? "live feed" : "simulation (play money)"}</>}>
        <button className="adm-btn" onClick={reload}>Refresh</button>
      </Head>
      <div className="adm-grid">
        <Stat k="GGR today" v={naira(s.ggr.today)} tone={green(s.ggr.today)} s={<>7 days {naira(s.ggr.week)} · all time {naira(s.ggr.all)}</>} />
        <Stat k="Staked today" v={naira(s.bets.today.stake)} s={<>{s.bets.today.count} bets · 7 days {naira(s.bets.week.stake)}</>} />
        <Stat k="Open bets" v={s.open.count} s={<>{naira(s.open.stake)} staked</>} />
        <Stat k="Open liability" v={naira(s.open.liability)} tone="#FFB547" s="Most we could pay if every open bet won" />
        <Stat k="Players" v={s.users.total} s={<>+{s.users.today} today · +{s.users.week} this week{s.users.suspended ? ` · ${s.users.suspended} suspended` : ""}</>} />
        <Stat k="Player balances" v={naira(s.playerBalances)} s={<>Bonuses paid {naira(s.bonusesPaid)}</>} />
      </div>
      <div className="adm-section adm-card">
        <h2>Staked per day (last 14 days)</h2>
        {s.byDay.length ? (
          <div className="adm-bars">
            {s.byDay.map((d) => (
              <div key={d.day} className="bar" title={`${d.day}: ${naira(d.stake)} · ${d.bets} bets`}>
                <div className="fill" style={{ height: `${Math.round((d.stake / max) * 110)}px` }} />
                <span className="lbl">{d.day.slice(8)}</span>
              </div>
            ))}
          </div>
        ) : <div className="adm-empty">No bets in the last 14 days.</div>}
      </div>
    </>
  );
}

// ---------- users ----------
type UserRow = { id: string; name: string; email: string | null; phone: string | null; role: string; suspended: boolean; suspendedReason: string | null; deleted: boolean; createdAt: string; balance: number; bets: number };
const userBadges = (u: UserRow) => (
  <span style={{ display: "inline-flex", gap: 6 }}>
    {u.role === "ADMIN" && <Badge tone="blue">ADMIN</Badge>}
    {u.suspended && <Badge tone="red">SUSPENDED</Badge>}
    {u.deleted && <Badge tone="gray">DELETED</Badge>}
  </span>
);

function UsersPage() {
  const params = useSearchParams();
  const router = useRouter();
  const qs = params?.toString() ?? "";
  const { data, error } = useApi<{ total: number; pageSize: number; users: UserRow[] }>(`/admin/users${qs ? `?${qs}` : ""}`);
  return (
    <>
      <Head title="Users" sub={data ? `${data.total} accounts` : ""}><SearchBox placeholder="Name, phone, email or id" /></Head>
      <div style={{ marginBottom: 12 }}><Tabs name="filter" options={[["", "All"], ["suspended", "Suspended"], ["admins", "Admins"]]} /></div>
      {!data ? <Loading error={error} /> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th className="adm-num">Balance</th><th className="adm-num">Bets</th><th>Joined</th><th /></tr></thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="click" onClick={() => router.push(`/office/users/${u.id}`)}>
                  <td style={{ fontWeight: 700 }}>{u.name}</td><td>{u.phone ?? "—"}</td><td>{u.email ?? "—"}</td>
                  <td className="adm-num">{naira(u.balance)}</td><td className="adm-num">{u.bets}</td><td>{day(u.createdAt)}</td><td>{userBadges(u)}</td>
                </tr>
              ))}
              {!data.users.length && <tr><td colSpan={7} className="adm-empty">No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager total={data.total} pageSize={data.pageSize} />}
    </>
  );
}

type AuditEntry = { id: string; adminId: string; admin?: string; action: string; targetType: string; targetId: string; details: Record<string, unknown> | null; createdAt: string };
type BetRow = { id: string; ticket: string; type: string; status: string; stake: number; totalOdds: number; potentialPayout: number; payout: number | null; selections: number; createdAt: string; settledAt: string | null; user?: { name: string; phone: string | null }; userId?: string };
type UserDetail = UserRow & {
  dateOfBirth: string | null; emailVerified: boolean; phoneVerified: boolean; referralCode: string | null; bonusClaimed: boolean;
  totals: { staked: number; paidOut: number; net: number };
  bets: BetRow[]; transactions: { id: string; type: string; amount: number; balanceAfter: number | null; reference: string | null; status: string; createdAt: string }[];
  audit: AuditEntry[];
};

function UserPage({ id, flash }: { id: string; flash: (m: string) => void }) {
  const router = useRouter();
  const { data: u, error, reload } = useApi<UserDetail>(`/admin/users/${id}`);
  const dialog = useDialog((m) => { flash(m); reload(); });
  if (!u) return <><Head title="User" /><Loading error={error} /></>;
  const adjust = () => dialog.open({
    title: "Adjust balance", confirm: "Apply", text: <>Current balance {naira(u.balance)}. Use a minus sign to take money off (never below ₦0).</>,
    fields: (set, v) => <label className="adm-field">Amount in naira (e.g. 500 or -200)<input className="adm-input" inputMode="decimal" value={v.amount ?? ""} onChange={(e) => set("amount", e.target.value)} required /></label>,
    run: async (v) => {
      const amount = Number(v.amount);
      if (!amount) throw new Error("Enter an amount");
      const r = await api<{ balance: number }>(`/admin/users/${u.id}/adjust`, { amount, reason: v.reason });
      return `Balance is now ${naira(r.balance)}`;
    },
  });
  const suspend = () => dialog.open(u.suspended
    ? { title: "Lift suspension", confirm: "Unsuspend", tone: "good", text: <>They'll be able to log in and bet again.{u.suspendedReason && <> Suspended for: {u.suspendedReason}</>}</>, run: async (v) => { await api(`/admin/users/${u.id}/unsuspend`, { reason: v.reason }); return "Suspension lifted"; } }
    : { title: `Suspend ${u.name}`, confirm: "Suspend", tone: "danger", text: "They'll be logged out and can't log in or bet until the suspension is lifted. Open bets still settle.", run: async (v) => { await api(`/admin/users/${u.id}/suspend`, { reason: v.reason }); return "Account suspended"; } });
  const role = () => dialog.open({
    title: u.role === "ADMIN" ? "Remove admin access" : "Make admin", confirm: u.role === "ADMIN" ? "Remove access" : "Make admin", tone: u.role === "ADMIN" ? "danger" : "primary",
    text: u.role === "ADMIN" ? "They'll lose access to this panel." : "They'll get full access to this panel.",
    run: async (v) => { await api(`/admin/users/${u.id}/role`, { role: u.role === "ADMIN" ? "USER" : "ADMIN", reason: v.reason }); return "Role updated"; },
  });
  const remove = () => dialog.open({
    title: `Delete ${u.name}'s account`, confirm: "Delete account", tone: "danger",
    text: <>Their name, phone, email and date of birth are erased and they can never log in again. Bets and wallet history are kept for the records. Their phone number and email can be used to sign up again. <b>This can't be undone.</b>{u.balance > 0 && <> They still have {naira(u.balance)}.</>}</>,
    fields: (set, v) => <label className="adm-field">Type DELETE to confirm<input className="adm-input" value={v.confirm ?? ""} onChange={(e) => set("confirm", e.target.value.toUpperCase())} autoCapitalize="characters" required /></label>,
    run: async (v) => {
      if (v.confirm !== "DELETE") throw new Error("Type DELETE to confirm");
      await api(`/admin/users/${u.id}/delete`, { confirm: "DELETE", reason: v.reason });
      return "Account deleted";
    },
  });
  const TX_LABEL: Record<string, string> = { BET_STAKE: "Bet stake", BET_PAYOUT: "Winnings", BET_REFUND: "Refund", BONUS: "Bonus", DEMO_TOPUP: "Play money", ADJUSTMENT: "Admin adjustment", DEPOSIT: "Deposit", WITHDRAWAL: "Withdrawal" };
  return (
    <>
      <Head title={<span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>{u.name} {userBadges(u)}</span>} sub={<>Joined {day(u.createdAt)} · id {u.id}</>}>
        {!u.deleted && <>
          <button className="adm-btn primary" onClick={adjust}>Adjust balance</button>
          <button className={`adm-btn ${u.suspended ? "good" : "danger"}`} onClick={suspend}>{u.suspended ? "Unsuspend" : "Suspend"}</button>
          <button className="adm-btn" onClick={role}>{u.role === "ADMIN" ? "Remove admin" : "Make admin"}</button>
          {u.role !== "ADMIN" && <button className="adm-btn danger" onClick={remove}>Delete account</button>}
        </>}
      </Head>
      <div className="adm-grid">
        <Stat k="Balance" v={naira(u.balance)} />
        <Stat k="Total staked" v={naira(u.totals.staked)} s={`${u.bets.length ? u.bets.length : 0} recent bets shown`} />
        <Stat k="Paid out" v={naira(u.totals.paidOut)} />
        <Stat k="Net to us" v={naira(u.totals.net)} tone={u.totals.net >= 0 ? "#5BD69A" : "#FF8A8E"} s="Staked − paid out" />
      </div>
      <div className="adm-section adm-card">
        <div className="adm-kv">
          {[["Phone", u.phone ? `${u.phone}${u.phoneVerified ? " ✓" : ""}` : "—"], ["Email", u.email ? `${u.email}${u.emailVerified ? " ✓ verified" : " (not verified)"}` : "—"],
            ["Date of birth", u.dateOfBirth ?? "—"], ["Promo code", u.referralCode ?? "—"], ["Welcome bonus", u.bonusClaimed ? "Claimed" : "Not claimed"],
            ["Suspension", u.suspended ? u.suspendedReason ?? "Suspended" : "—"]].map(([k, v]) => <div key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}
        </div>
      </div>
      <div className="adm-section">
        <h2>Recent bets</h2>
        <BetTable bets={u.bets} onOpen={(b) => router.push(`/office/bets/${b.id}`)} />
      </div>
      <div className="adm-section">
        <h2>Wallet history</h2>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>When</th><th>Type</th><th className="adm-num">Amount</th><th className="adm-num">Balance after</th><th>Reference</th></tr></thead>
            <tbody>
              {u.transactions.map((t) => (
                <tr key={t.id}><td>{when(t.createdAt)}</td><td>{TX_LABEL[t.type] ?? t.type}</td>
                  <td className="adm-num" style={{ color: t.amount >= 0 ? "#5BD69A" : "#FF8A8E" }}>{t.amount >= 0 ? "+" : ""}{naira(t.amount)}</td>
                  <td className="adm-num">{naira(t.balanceAfter)}</td><td style={{ color: "var(--label)", fontSize: 12 }}>{t.reference ?? ""}</td></tr>
              ))}
              {!u.transactions.length && <tr><td colSpan={5} className="adm-empty">No transactions.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {u.audit.length > 0 && <div className="adm-section"><h2>Admin history</h2><AuditTable entries={u.audit} /></div>}
      {dialog.node}
    </>
  );
}

// ---------- bets ----------
function BetTable({ bets, onOpen, withUser }: { bets: BetRow[]; onOpen: (b: BetRow) => void; withUser?: boolean }) {
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead><tr><th>Ticket</th>{withUser && <th>Player</th>}<th>Type</th><th className="adm-num">Stake</th><th className="adm-num">Odds</th><th className="adm-num">To win</th><th className="adm-num">Paid</th><th>Status</th><th>Placed</th></tr></thead>
        <tbody>
          {bets.map((b) => (
            <tr key={b.id} className="click" onClick={() => onOpen(b)}>
              <td style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{b.ticket}</td>
              {withUser && <td>{b.user?.name}<div style={{ fontSize: 12, color: "var(--label)" }}>{b.user?.phone}</div></td>}
              <td>{b.type === "ACCUMULATOR" ? `Multiple (${b.selections})` : "Single"}</td>
              <td className="adm-num">{naira(b.stake)}</td><td className="adm-num">{b.totalOdds.toFixed(2)}</td>
              <td className="adm-num">{naira(b.potentialPayout)}</td><td className="adm-num">{b.payout == null ? "—" : naira(b.payout)}</td>
              <td><Badge tone={STATUS_TONE[b.status] ?? "gray"}>{b.status}</Badge></td><td>{when(b.createdAt)}</td>
            </tr>
          ))}
          {!bets.length && <tr><td colSpan={withUser ? 9 : 8} className="adm-empty">No bets.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function BetsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const qs = params?.toString() ?? "";
  const { data, error } = useApi<{ total: number; pageSize: number; bets: BetRow[] }>(`/admin/bets${qs ? `?${qs}` : ""}`);
  return (
    <>
      <Head title="Bets" sub={data ? `${data.total} bets` : ""}><SearchBox placeholder="Ticket, player phone, email or name" /></Head>
      <div style={{ marginBottom: 12 }}><Tabs name="status" options={[["", "All"], ["PENDING", "Open"], ["WON", "Won"], ["LOST", "Lost"], ["VOID", "Void"]]} /></div>
      {!data ? <Loading error={error} /> : <BetTable bets={data.bets} withUser onOpen={(b) => router.push(`/office/bets/${b.id}`)} />}
      {data && <Pager total={data.total} pageSize={data.pageSize} />}
    </>
  );
}

type BetDetail = BetRow & { legs: { id: string; matchId: string; home: string; away: string; league: string; kickoff: string | null; market: string; selection: string; odds: number; result: string }[]; audit: AuditEntry[] };
function BetPage({ id, flash }: { id: string; flash: (m: string) => void }) {
  const { data: b, error, reload } = useApi<BetDetail>(`/admin/bets/${id}`);
  const dialog = useDialog((m) => { flash(m); reload(); });
  if (!b) return <><Head title="Bet" /><Loading error={error} /></>;
  const open = b.status === "PENDING";
  const settled = (r: { status: string; payout: number | null }) => `Bet is now ${r.status}${r.payout ? ` · paid ${naira(r.payout)}` : ""}`;
  const betAction = (kind: "WON" | "LOST" | "VOID") => dialog.open({
    title: kind === "VOID" ? "Void this bet" : `Settle as ${kind === "WON" ? "won" : "lost"}`,
    confirm: kind === "VOID" ? "Void bet" : `Settle ${kind === "WON" ? "won" : "lost"}`, tone: kind === "WON" ? "good" : "danger",
    text: kind === "VOID" ? <>Every leg becomes void and the stake ({naira(b.stake)}) goes back to the player.</>
      : kind === "WON" ? <>All open legs are marked won. The player is paid by the normal rules (up to {naira(b.potentialPayout)}).</> : "All open legs are marked lost. Nothing is paid.",
    run: async (v) => settled(await api<{ status: string; payout: number | null }>(`/admin/bets/${b.id}/${kind === "VOID" ? "void" : "settle"}`, kind === "VOID" ? { reason: v.reason } : { result: kind, reason: v.reason })),
  });
  const legAction = (leg: BetDetail["legs"][number], result: "WON" | "LOST" | "VOID") => dialog.open({
    title: `${leg.home} vs ${leg.away}: ${result.toLowerCase()}`, confirm: `Mark ${result.toLowerCase()}`, tone: result === "WON" ? "good" : "danger",
    text: <>{leg.market} · {leg.selection} @ {leg.odds.toFixed(2)}. The bet settles as soon as no legs are open.</>,
    run: async (v) => settled(await api<{ status: string; payout: number | null }>(`/admin/bets/${b.id}/legs/${leg.id}`, { result, reason: v.reason })),
  });
  return (
    <>
      <Head title={<span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>Ticket {b.ticket} <Badge tone={STATUS_TONE[b.status] ?? "gray"}>{b.status}</Badge></span>}
        sub={<>{b.type === "ACCUMULATOR" ? "Multiple" : "Single"} · placed {when(b.createdAt)}{b.settledAt ? ` · settled ${when(b.settledAt)}` : ""} · <Link href={`/office/users/${b.userId}`} style={{ textDecoration: "underline" }}>{b.user?.name}</Link></>}>
        {open && <>
          <button className="adm-btn good" onClick={() => betAction("WON")}>Settle won</button>
          <button className="adm-btn danger" onClick={() => betAction("LOST")}>Settle lost</button>
          <button className="adm-btn" onClick={() => betAction("VOID")}>Void</button>
        </>}
      </Head>
      <div className="adm-grid">
        <Stat k="Stake" v={naira(b.stake)} /><Stat k="Total odds" v={b.totalOdds.toFixed(2)} />
        <Stat k="Potential payout" v={naira(b.potentialPayout)} /><Stat k="Paid" v={b.payout == null ? "—" : naira(b.payout)} />
      </div>
      <div className="adm-section">
        <h2>Selections</h2>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Match</th><th>Kick-off</th><th>Market</th><th>Pick</th><th className="adm-num">Odds</th><th>Result</th>{open && <th />}</tr></thead>
            <tbody>
              {b.legs.map((l) => (
                <tr key={l.id}>
                  <td><b>{l.home} vs {l.away}</b><div style={{ fontSize: 12, color: "var(--label)" }}>{l.league} · {l.matchId}</div></td>
                  <td>{when(l.kickoff)}</td><td>{l.market}</td><td>{l.selection}</td><td className="adm-num">{l.odds.toFixed(2)}</td>
                  <td><Badge tone={STATUS_TONE[l.result] ?? "gray"}>{l.result}</Badge></td>
                  {open && <td>{l.result === "PENDING" && <div className="adm-actions">
                    <button className="adm-btn sm good" onClick={() => legAction(l, "WON")}>Won</button>
                    <button className="adm-btn sm danger" onClick={() => legAction(l, "LOST")}>Lost</button>
                    <button className="adm-btn sm" onClick={() => legAction(l, "VOID")}>Void</button>
                  </div>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {b.audit.length > 0 && <div className="adm-section"><h2>Admin history</h2><AuditTable entries={b.audit} /></div>}
      {dialog.node}
    </>
  );
}

// ---------- matches ----------
type MatchRow = { matchId: string; home: string; away: string; league: string; country: string; kickoff: string; state: string; odds1x2: number[] | null; pendingLegs: number; stake: number; liability: number; suspended: { reason: string; at: string } | null };
const STATE_BADGE: Record<string, [string, string]> = { live: ["red", "LIVE"], upcoming: ["gray", "UPCOMING"], started: ["yellow", "STARTED"], "off-board": ["blue", "FINISHED / OFF BOARD"] };

function MatchesPage({ flash }: { flash: (m: string) => void }) {
  const params = useSearchParams();
  const q = params?.get("q") ?? "";
  const filter = params?.get("show") ?? "";
  const { data, error, reload } = useApi<{ total: number; matches: MatchRow[] }>(`/admin/matches${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const dialog = useDialog((m) => { flash(m); reload(); });
  const rows = (data?.matches ?? []).filter((m) => !filter || (filter === "exposed" ? m.pendingLegs > 0 : filter === "suspended" ? !!m.suspended : m.state === filter));
  const name = (m: MatchRow) => `${m.home} vs ${m.away}`;
  const suspend = (m: MatchRow) => dialog.open(m.suspended
    ? { title: `Reopen ${name(m)}`, confirm: "Reopen betting", tone: "good", text: `Suspended for: ${m.suspended.reason}`, run: async (v) => { await api(`/admin/matches/${encodeURIComponent(m.matchId)}/unsuspend`, { reason: v.reason }); return "Betting reopened"; } }
    : { title: `Suspend ${name(m)}`, confirm: "Suspend", tone: "danger", text: "No new bets on this match; its odds show as locked on the site. Existing bets stay and settle normally.", run: async (v) => { await api(`/admin/matches/${encodeURIComponent(m.matchId)}/suspend`, { reason: v.reason, home: m.home, away: m.away, league: m.league }); return "Match suspended"; } });
  const voidAll = (m: MatchRow) => dialog.open({
    title: `Void all open bets on ${name(m)}`, confirm: "Void legs", tone: "danger",
    text: `${m.pendingLegs} open legs become void: singles get their stake back, multiples continue without this match.`,
    run: async (v) => { const r = await api<{ legs: number; betsSettled: number }>(`/admin/matches/${encodeURIComponent(m.matchId)}/void`, { reason: v.reason }); return `${r.legs} legs voided · ${r.betsSettled} bets settled`; },
  });
  const result = (m: MatchRow) => dialog.open({
    title: `Enter result: ${name(m)}`, confirm: "Settle from this score", tone: "primary",
    text: "Grades every open leg on this match from the final score (half-time score is needed for half-time markets).",
    fields: (set, v) => (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[["home", `${m.home} (full time)`], ["away", `${m.away} (full time)`], ["htHome", "Home at half time (optional)"], ["htAway", "Away at half time (optional)"]].map(([k, label]) => (
          <label key={k} className="adm-field">{label}<input className="adm-input" inputMode="numeric" value={v[k] ?? ""} onChange={(e) => set(k, e.target.value.replace(/\D/g, ""))} required={k === "home" || k === "away"} /></label>
        ))}
      </div>
    ),
    run: async (v) => {
      const ht = v.htHome !== undefined && v.htHome !== "" && v.htAway !== undefined && v.htAway !== "";
      const r = await api<{ legs: number; skipped: number; betsSettled: number }>(`/admin/matches/${encodeURIComponent(m.matchId)}/result`, {
        home: Number(v.home), away: Number(v.away), htHome: ht ? Number(v.htHome) : null, htAway: ht ? Number(v.htAway) : null, reason: v.reason,
      });
      return `${r.legs} legs graded · ${r.betsSettled} bets settled${r.skipped ? ` · ${r.skipped} need a half-time score` : ""}`;
    },
  });
  return (
    <>
      <Head title="Matches" sub="Live and upcoming board, plus finished matches that still have open bets. Sorted by liability."><SearchBox placeholder="Team, league or match id" /></Head>
      <div style={{ marginBottom: 12 }}><Tabs name="show" options={[["", "All"], ["exposed", "With open bets"], ["live", "Live"], ["upcoming", "Upcoming"], ["off-board", "Finished"], ["suspended", "Suspended"]]} /></div>
      {!data ? <Loading error={error} /> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Match</th><th>Kick-off</th><th>State</th><th className="adm-num">1 · X · 2</th><th className="adm-num">Open legs</th><th className="adm-num">Stake</th><th className="adm-num">Liability</th><th /></tr></thead>
            <tbody>
              {rows.map((m) => {
                const [tone, label] = STATE_BADGE[m.state] ?? ["gray", m.state.toUpperCase()];
                return (
                  <tr key={m.matchId}>
                    <td><b>{name(m)}</b><div style={{ fontSize: 12, color: "var(--label)" }}>{[m.country, m.league].filter(Boolean).join(" · ")} · {m.matchId}</div></td>
                    <td>{when(m.kickoff)}</td>
                    <td><span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}><Badge tone={tone}>{label}</Badge>{m.suspended && <Badge tone="red">SUSPENDED</Badge>}</span></td>
                    <td className="adm-num">{m.odds1x2 ? m.odds1x2.map((o) => (o ? o.toFixed(2) : "–")).join(" · ") : "—"}</td>
                    <td className="adm-num">{m.pendingLegs || "—"}</td><td className="adm-num">{m.pendingLegs ? naira(m.stake) : "—"}</td>
                    <td className="adm-num" style={{ color: m.liability ? "#FFB547" : undefined }}>{m.pendingLegs ? naira(m.liability) : "—"}</td>
                    <td><div className="adm-actions" style={{ justifyContent: "flex-end" }}>
                      {m.state !== "off-board" && <button className={`adm-btn sm ${m.suspended ? "good" : "danger"}`} onClick={() => suspend(m)}>{m.suspended ? "Reopen" : "Suspend"}</button>}
                      {m.pendingLegs > 0 && <button className="adm-btn sm" onClick={() => result(m)}>Result</button>}
                      {m.pendingLegs > 0 && <button className="adm-btn sm" onClick={() => voidAll(m)}>Void</button>}
                    </div></td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td colSpan={8} className="adm-empty">No matches.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {dialog.node}
    </>
  );
}

// ---------- audit log ----------
const ACTION_LABEL: Record<string, string> = {
  USER_SUSPEND: "Suspended user", USER_DELETE: "Deleted account", USER_UNSUSPEND: "Lifted suspension", BALANCE_ADJUST: "Adjusted balance", ROLE_GRANT: "Made admin", ROLE_REVOKE: "Removed admin",
  BET_VOID: "Voided bet", BET_SETTLE: "Settled bet", LEG_SETTLE: "Settled leg", MATCH_SUSPEND: "Suspended match", MATCH_UNSUSPEND: "Reopened match",
  MATCH_VOID: "Voided match bets", MATCH_RESULT: "Entered result",
};
function AuditTable({ entries }: { entries: AuditEntry[] }) {
  const target = (e: AuditEntry) => e.targetType === "USER" ? <Link href={`/office/users/${e.targetId}`} style={{ textDecoration: "underline" }}>user</Link>
    : e.targetType === "BET" ? <Link href={`/office/bets/${e.targetId}`} style={{ textDecoration: "underline" }}>bet</Link> : <span>match {e.targetId}</span>;
  const details = (d: AuditEntry["details"]) => d ? Object.entries(d).filter(([k]) => k !== "reason").map(([k, v]) => `${k === "balanceAfter" ? "balance after" : k}: ${typeof v === "number" && (k === "amount" || k === "balanceAfter") ? naira(v) : String(v)}`).join(" · ") : "";
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>On</th><th>Reason</th><th>Details</th></tr></thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{when(e.createdAt)}</td><td>{e.admin ?? e.adminId.slice(0, 8)}</td><td><b>{ACTION_LABEL[e.action] ?? e.action}</b></td><td>{target(e)}</td>
              <td>{String(e.details?.reason ?? "")}</td><td style={{ fontSize: 12, color: "var(--muted)" }}>{details(e.details)}</td>
            </tr>
          ))}
          {!entries.length && <tr><td colSpan={6} className="adm-empty">Nothing yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function AuditPage() {
  const params = useSearchParams();
  const qs = params?.toString() ?? "";
  const { data, error } = useApi<{ total: number; pageSize: number; entries: AuditEntry[] }>(`/admin/audit${qs ? `?${qs}` : ""}`);
  return (
    <>
      <Head title="Audit log" sub="Every change made in this panel: who, what, when and why." />
      {!data ? <Loading error={error} /> : <AuditTable entries={data.entries} />}
      {data && <Pager total={data.total} pageSize={data.pageSize} />}
    </>
  );
}

// ---------- reports (read from the database's report views) ----------
type Row = Record<string, string | number | null>;
function downloadCsv(name: string, rows: Row[], cols: [string, string][]) {
  const cell = (v: unknown) => {
    const t = v == null ? "" : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const csv = [cols.map(([, h]) => cell(h)).join(","), ...rows.map((r) => cols.map(([k]) => cell(r[k])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type Col = [key: string, label: string, kind?: "ngn" | "num" | "date" | "text"];
function ReportTable({ title, sub, rows, cols, file, link }: { title: string; sub?: string; rows: Row[] | null; cols: Col[]; file: string; link?: (r: Row) => string }) {
  const router = useRouter();
  const fmt = (v: unknown, kind?: Col[2]) => v == null || v === "" ? "—"
    : kind === "ngn" ? naira(Number(v)) : kind === "num" ? Number(v).toLocaleString("en-US")
    : kind === "date" ? day(String(v)) : String(v);
  return (
    <div className="adm-section">
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div><h2 style={{ margin: 0 }}>{title}</h2>{sub && <div className="adm-sub">{sub}</div>}</div>
        <button className="adm-btn sm" disabled={!rows?.length} onClick={() => rows && downloadCsv(file, rows, cols.map(([k, l]) => [k, l]))}>Download CSV</button>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr>{cols.map(([k, l, kind]) => <th key={k} className={kind === "ngn" || kind === "num" ? "adm-num" : undefined}>{l}</th>)}</tr></thead>
          <tbody>
            {rows?.map((r, i) => (
              <tr key={i} className={link ? "click" : undefined} onClick={link ? () => router.push(link(r)) : undefined}>
                {cols.map(([k, , kind]) => (
                  <td key={k} className={kind === "ngn" || kind === "num" ? "adm-num" : undefined}
                    style={k === "ggr_ngn" && r[k] != null ? { color: Number(r[k]) >= 0 ? "#5BD69A" : "#FF8A8E", fontWeight: 700 } : undefined}>{fmt(r[k], kind)}</td>
                ))}
              </tr>
            ))}
            {rows && !rows.length && <tr><td colSpan={cols.length} className="adm-empty">No data yet.</td></tr>}
            {!rows && <tr><td colSpan={cols.length} className="adm-empty">Loading…</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Bars for one daily number; negative values (e.g. GGR on a losing day) hang below the line.
function DayBars({ rows, k, color }: { rows: Row[]; k: string; color: string }) {
  const vals = rows.map((r) => Number(r[k]) || 0);
  const max = Math.max(1, ...vals.map(Math.abs));
  const neg = vals.some((v) => v < 0);
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 3, height: 130 }}>
      {rows.map((r, i) => {
        const v = vals[i];
        const h = Math.round((Math.abs(v) / max) * (neg ? 60 : 118));
        return (
          <div key={String(r.day)} title={`${r.day}: ${naira(v)}`} style={{ flex: 1, minWidth: 0, maxWidth: 40, display: "flex", flexDirection: "column", justifyContent: neg ? "center" : "flex-end" }}>
            <div style={{ height: neg ? 60 : undefined, display: "flex", alignItems: "flex-end" }}>{v > 0 && <div style={{ width: "100%", height: h, background: color, borderRadius: "3px 3px 0 0" }} />}</div>
            {neg && <div style={{ height: 60 }}>{v < 0 && <div style={{ width: "100%", height: h, background: "#E5484D", borderRadius: "0 0 3px 3px" }} />}</div>}
          </div>
        );
      })}
    </div>
  );
}

function ReportsPage() {
  const [range, setRange] = useQueryState("days");
  const days = Number(range) || 30;
  const daily = useApi<{ rows: Row[] }>(`/admin/reports/daily?days=${days}`);
  const leagues = useApi<{ rows: Row[] }>("/admin/reports/leagues");
  const markets = useApi<{ rows: Row[] }>("/admin/reports/markets");
  const players = useApi<{ rows: Row[] }>("/admin/reports/players?limit=50");
  const rows = daily.data?.rows ?? null;
  const sum = (k: string) => (rows ?? []).reduce((a, r) => a + (Number(r[k]) || 0), 0);
  return (
    <>
      <Head title="Reports" sub="Straight from the database's report views (naira, Lagos days). The same numbers any analytics tool sees.">
        <div className="adm-tabs">
          {[7, 30, 90, 365].map((d) => <button key={d} className={`adm-tab${days === d ? " on" : ""}`} onClick={() => setRange(String(d))}>{d === 365 ? "1 year" : `${d} days`}</button>)}
        </div>
      </Head>
      {daily.error && <Loading error={daily.error} />}
      {rows && (
        <>
          <div className="adm-grid">
            <Stat k={`GGR · ${days} days`} v={naira(sum("ggr_ngn"))} tone={sum("ggr_ngn") >= 0 ? "#5BD69A" : "#FF8A8E"} s={`${sum("bets_settled").toLocaleString()} bets settled`} />
            <Stat k="Staked" v={naira(sum("stake_ngn"))} s={`${sum("bets_placed").toLocaleString()} bets placed`} />
            <Stat k="Paid out" v={naira(sum("payouts_ngn"))} s={`Bonuses ${naira(sum("bonuses_ngn"))}`} />
            <Stat k="New players" v={sum("signups").toLocaleString()} s={`Deposits ${naira(sum("deposits_ngn"))} · withdrawals ${naira(sum("withdrawals_ngn"))}`} />
          </div>
          <div className="adm-section" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
            <div className="adm-card"><h2 style={{ fontSize: 15, margin: "0 0 12px" }}>Staked per day</h2><DayBars rows={rows} k="stake_ngn" color="#F5C518" /></div>
            <div className="adm-card"><h2 style={{ fontSize: 15, margin: "0 0 12px" }}>GGR per day</h2><DayBars rows={rows} k="ggr_ngn" color="#2AB572" /></div>
          </div>
        </>
      )}
      <ReportTable title="Daily numbers" sub="One row per day, newest first" file="daily-kpis" rows={rows ? [...rows].reverse() : null} cols={[
        ["day", "Day", "date"], ["signups", "Sign-ups", "num"], ["active_logins", "Logged in", "num"], ["active_bettors", "Bettors", "num"],
        ["bets_placed", "Bets", "num"], ["stake_ngn", "Staked", "ngn"], ["bets_settled", "Settled", "num"], ["payouts_ngn", "Paid out", "ngn"],
        ["ggr_ngn", "GGR", "ngn"], ["bonuses_ngn", "Bonuses", "ngn"], ["deposits_ngn", "Deposits", "ngn"], ["withdrawals_ngn", "Withdrawals", "ngn"],
      ]} />
      <ReportTable title="GGR by league" sub="Settled bets; a multiple's stake is split evenly across its legs" file="ggr-by-league" rows={leagues.data?.rows ?? null} cols={[
        ["league", "League", "text"], ["country", "Country", "text"], ["bets", "Bets", "num"], ["legs", "Legs", "num"],
        ["stake_ngn", "Staked", "ngn"], ["payouts_ngn", "Paid out", "ngn"], ["ggr_ngn", "GGR", "ngn"],
      ]} />
      <ReportTable title="GGR by market" sub="Settled bets" file="ggr-by-market" rows={markets.data?.rows ?? null} cols={[
        ["market_label", "Market", "text"], ["bets", "Bets", "num"], ["legs", "Legs", "num"],
        ["stake_ngn", "Staked", "ngn"], ["payouts_ngn", "Paid out", "ngn"], ["ggr_ngn", "GGR", "ngn"],
      ]} />
      <ReportTable title="Top players" sub="By amount staked (top 50). Click a row for the player." file="top-players" rows={players.data?.rows ?? null}
        link={(r) => `/office/users/${r.user_id}`} cols={[
        ["display_name", "Player", "text"], ["signup_source", "Came from", "text"], ["bets", "Bets", "num"], ["days_active", "Days active", "num"],
        ["stake_ngn", "Staked", "ngn"], ["payouts_ngn", "Paid out", "ngn"], ["ggr_ngn", "GGR", "ngn"], ["bonuses_ngn", "Bonuses", "ngn"],
        ["balance_ngn", "Balance", "ngn"], ["last_bet_at", "Last bet", "date"],
      ]} />
    </>
  );
}
