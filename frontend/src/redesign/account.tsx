// Account page (/account): profile, balance and stats, edit details, verify email, change
// password, log out and delete the account. Edits happen in bottom sheets.
import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api, type Profile } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { THEMES, useTheme } from "../context/ThemeContext";
import { CodeBoxes, formInput, hiddenPw, primaryBtn } from "./auth";
import { CheckIcon, ChevronRight, EyeIcon, EyeOffIcon } from "./icons";
import { ACCENT, Loader, Sheet, SheetTitle } from "./shared";

const barlow = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const naira = (v: number) => `₦${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const errText = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong. Please try again.");
const GREEN = "#2AB572";
const RED = "#E5484D";

const card: CSSProperties = { background: "var(--tc-card)", border: "1px solid var(--tc-card-line)", borderRadius: 16 };
const sectionTitle: CSSProperties = { margin: "0 0 8px", fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "var(--tc-label)" };
const rowStyle: CSSProperties = {
  width: "100%", minHeight: 56, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, border: "none",
  borderTop: "1px solid var(--tc-line)", background: "transparent", color: "var(--tc-text)", textAlign: "left", font: "inherit",
};

const Badge = ({ ok, children }: { ok: boolean; children: ReactNode }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, color: ok ? GREEN : ACCENT, background: ok ? "rgba(42, 181, 114, 0.12)" : "rgba(245, 197, 24, 0.12)" }}>
    {ok && <CheckIcon size={11} />}{children}
  </span>
);

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 14, color: "var(--tc-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

function PasswordInput({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "block" }}>
      <input type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...formInput(false), paddingRight: 56, ...(show ? {} : hiddenPw) }} />
      <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)} style={{ position: "absolute", right: 4, top: 4, width: 44, height: 44, border: "none", background: "transparent", color: "var(--tc-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {show ? <EyeIcon /> : <EyeOffIcon />}
      </button>
    </span>
  );
}

const sheetBody: CSSProperties = { display: "flex", flexDirection: "column", gap: 16, padding: "4px 20px 24px" };
const errorLine = (msg: string | null) => msg && <p role="alert" style={{ margin: 0, fontSize: 13, color: RED }}>{msg}</p>;

// ---------- sheets ----------
function EditSheet({ me, onClose, onSaved }: { me: Profile; onClose: () => void; onSaved: (p: Profile) => void }) {
  const [firstName, setFirstName] = useState(me.firstName ?? me.displayName);
  const [lastName, setLastName] = useState(me.lastName ?? "");
  const [email, setEmail] = useState(me.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailChanged = email.trim().toLowerCase() !== (me.email ?? "").toLowerCase();
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.updateMe({ firstName: firstName.trim(), lastName: lastName.trim(), ...(emailChanged ? { email: email.trim() } : {}) }));
      onClose();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet label="Edit details" onClose={onClose}>
      <SheetTitle title="Edit details" onClose={onClose} />
      <form onSubmit={save} style={sheetBody}>
        <Field label="Name"><input autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={formInput(false)} /></Field>
        <Field label="Surname"><input autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={formInput(false)} /></Field>
        <Field label="Email"><input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} style={formInput(false)} /></Field>
        {emailChanged && me.email && <p style={{ margin: 0, fontSize: 13, color: "var(--tc-muted)" }}>You'll need to verify the new email.</p>}
        {errorLine(error)}
        <button type="submit" disabled={busy} style={primaryBtn(!busy)}>{busy ? "SAVING…" : "SAVE CHANGES"}</button>
      </form>
    </Sheet>
  );
}

function VerifyEmailSheet({ me, onClose, onVerified }: { me: Profile; onClose: () => void; onVerified: (p: Profile) => void }) {
  const [sent, setSent] = useState<{ sentTo: string; demoCode?: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.emailCodeStart();
      setSent(res);
      setWait(res.resendIn);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { send(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function check(value: string) {
    setBusy(true);
    setError(null);
    try {
      onVerified(await api.emailCodeVerify(value));
      onClose();
    } catch (err) {
      setError(errText(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet label="Verify your email" onClose={onClose}>
      <SheetTitle title="Verify your email" onClose={onClose} />
      <div style={sheetBody}>
        <p style={{ margin: 0, fontSize: 15, color: "var(--tc-muted)" }}>Enter the 6-digit code we sent to <strong style={{ color: "var(--tc-text)" }}>{me.email}</strong></p>
        {sent?.demoCode && (
          <p style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: "rgba(245, 197, 24, 0.12)", border: "1px solid rgba(245, 197, 24, 0.35)", fontSize: 13, color: "var(--tc-soft)" }}>
            Demo mode — no email is sent. Your code is <strong style={{ color: ACCENT, letterSpacing: 2 }}>{sent.demoCode}</strong>
          </p>
        )}
        <CodeBoxes value={code} error={!!error} onChange={(v) => { setCode(v); setError(null); if (v.length === 6) check(v); }} />
        {errorLine(error)}
        <button type="button" onClick={() => check(code)} disabled={busy || code.length !== 6} style={primaryBtn(code.length === 6 && !busy)}>{busy ? "CHECKING…" : "VERIFY EMAIL"}</button>
        <p style={{ margin: 0, fontSize: 14, color: "var(--tc-muted)", textAlign: "center" }}>
          Didn't get it?{" "}
          {wait > 0 ? <span>Resend in 0:{String(wait).padStart(2, "0")}</span>
            : <button type="button" onClick={send} style={{ padding: 0, border: "none", background: "transparent", color: ACCENT, fontSize: 14, fontWeight: 800 }}>Resend code</button>}
        </p>
      </div>
    </Sheet>
  );
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setError("Use at least 8 characters");
    setBusy(true);
    setError(null);
    try {
      await api.changePassword(current, next);
      setDone(true);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet label="Change password" onClose={onClose}>
      <SheetTitle title="Change password" onClose={onClose} />
      {done ? (
        <div style={sheetBody}>
          <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700, color: GREEN }}><CheckIcon size={18} />Password changed</p>
          <button type="button" onClick={onClose} style={primaryBtn(true)}>DONE</button>
        </div>
      ) : (
        <form onSubmit={save} style={sheetBody}>
          <Field label="Current password"><PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" /></Field>
          <Field label="New password"><PasswordInput value={next} onChange={setNext} autoComplete="new-password" /></Field>
          <span style={{ fontSize: 12, color: next.length >= 8 ? GREEN : "var(--tc-label)" }}>At least 8 characters</span>
          {errorLine(error)}
          <button type="submit" disabled={busy} style={primaryBtn(!!current && next.length >= 8 && !busy)}>{busy ? "SAVING…" : "CHANGE PASSWORD"}</button>
        </form>
      )}
    </Sheet>
  );
}

function DeleteSheet({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = typed === "DELETE" && !!password && !busy;
  async function remove(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(password);
      onDeleted();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet label="Delete account" onClose={onClose}>
      <SheetTitle title="Delete account" onClose={onClose} />
      <form onSubmit={remove} style={sheetBody}>
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(229, 72, 77, 0.1)", border: "1px solid rgba(229, 72, 77, 0.4)", fontSize: 14, lineHeight: 1.5, color: "var(--tc-soft)" }}>
          This can't be undone. Your name, phone number, email and login are erased and you'll be logged out everywhere.
          Records of your bets and payments are kept, as the law requires.
        </div>
        <Field label='Type DELETE to confirm'><input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" style={formInput(false)} /></Field>
        <Field label="Your password"><PasswordInput value={password} onChange={setPassword} autoComplete="current-password" /></Field>
        {errorLine(error)}
        <button type="submit" disabled={!ready} style={{ ...primaryBtn(ready), background: ready ? RED : "var(--tc-raise)", color: ready ? "#FFFFFF" : "var(--tc-faint)" }}>
          {busy ? "DELETING…" : "DELETE MY ACCOUNT"}
        </button>
      </form>
    </Sheet>
  );
}

// ---------- the page ----------
export function RedesignAccount({ onSupport }: { onSupport: () => void }) {
  const navigate = useNavigate();
  const { isAuthenticated, logout, setBalance, updateUser } = useAuth();
  const { setTheme } = useTheme();
  const [me, setMe] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"edit" | "email" | "password" | "delete" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate("/login", { replace: true }); return; }
    api.getMe().then(setMe).catch((err) => {
      if (err instanceof ApiError && err.status === 401) { logout(); navigate("/login", { replace: true }); }
      else setError(errText(err));
    });
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const saved = (p: Profile) => {
    setMe(p);
    setBalance(p.balance);
    updateUser({ displayName: p.displayName, email: p.email });
  };
  async function topUp() {
    try {
      const res = await api.demoTopUp();
      setBalance(res.balance);
      setMe((m) => (m ? { ...m, balance: res.balance } : m));
      setNote("₦10,000 demo funds added");
    } catch (err) {
      setNote(errText(err));
    }
  }

  if (error) return <p style={{ padding: "40px 0", textAlign: "center", color: "var(--tc-label)" }}>{error}</p>;
  if (!me) return <Loader label="Loading your account…" />;

  const fullName = [me.firstName ?? me.displayName, me.lastName].filter(Boolean).join(" ");
  const initials = fullName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const since = new Date(me.memberSince).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const dob = me.dateOfBirth ? new Date(`${me.dateOfBirth}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const stat = (label: string, value: string, color = "var(--tc-text)") => (
    <div style={{ ...card, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontFamily: barlow, fontSize: 26, fontWeight: 700, lineHeight: 1.1, color }}>{value}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tc-label)" }}>{label}</span>
    </div>
  );
  const detail = (label: string, value: ReactNode, extra?: ReactNode) => (
    <div style={{ ...rowStyle, cursor: "default" }}>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 12, color: "var(--tc-label)" }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
      </span>
      {extra}
    </div>
  );
  const link = (label: string, onClick: () => void, color = "var(--tc-text)") => (
    <button type="button" onClick={onClick} style={{ ...rowStyle, color, fontSize: 15, fontWeight: 700 }}>
      <span style={{ flex: 1 }}>{label}</span><ChevronRight />
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Profile */}
      <section style={{ ...card, overflow: "hidden", border: "1px solid rgba(245, 197, 24, 0.25)", background: "radial-gradient(120% 120% at 100% 0%, rgba(245, 197, 24, 0.16), transparent 60%), var(--tc-card)" }}>
        <div style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <span aria-hidden="true" style={{ width: 60, height: 60, flexShrink: 0, borderRadius: 30, background: ACCENT, color: "#13171C", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: barlow, fontSize: 26, fontWeight: 700 }}>{initials || "P"}</span>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fullName}</h1>
            {me.phoneDisplay && <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--tc-soft)" }}>{me.phoneDisplay}{me.phoneVerified && <Badge ok>Verified</Badge>}</span>}
            <span style={{ fontSize: 12, color: "var(--tc-label)" }}>Member since {since}</span>
          </div>
        </div>
        {/* Balance */}
        <div style={{ padding: "14px 18px 18px", borderTop: "1px solid var(--tc-line)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--tc-label)" }}>Balance{me.demo ? " · demo" : ""}</span>
            <span style={{ fontFamily: barlow, fontSize: 32, fontWeight: 700, color: ACCENT, lineHeight: 1 }}>{naira(me.balance)}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {me.demo
              ? <button type="button" onClick={topUp} style={{ flex: 1, height: 44, borderRadius: 10, border: "none", background: ACCENT, color: "#13171C", fontSize: 14, fontWeight: 800 }}>+ ₦10,000 demo</button>
              : <button type="button" disabled style={{ flex: 1, height: 44, borderRadius: 10, border: "none", background: "var(--tc-raise)", color: "var(--tc-faint)", fontSize: 14, fontWeight: 800 }}>Deposit · soon</button>}
            <button type="button" disabled style={{ flex: 1, height: 44, borderRadius: 10, border: "1px solid var(--tc-outline)", background: "transparent", color: "var(--tc-faint)", fontSize: 14, fontWeight: 800 }}>Withdraw · soon</button>
          </div>
          {note && <span role="status" style={{ fontSize: 12, color: "var(--tc-muted)", textAlign: "center" }}>{note}</span>}
        </div>
      </section>

      {/* Stats */}
      <section aria-label="Your betting" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        {stat("Bets placed", String(me.stats.bets))}
        {stat("Open bets", String(me.stats.open), ACCENT)}
        {stat("Bets won", String(me.stats.won), GREEN)}
        {stat("Total winnings", naira(me.stats.winnings), GREEN)}
      </section>

      {/* Email not verified yet */}
      {me.email && !me.emailVerified && (
        <button type="button" onClick={() => setSheet("email")} style={{ ...card, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, textAlign: "left", color: "var(--tc-text)", border: "1px solid rgba(245, 197, 24, 0.4)", cursor: "pointer" }}>
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>Verify your email</span>
            <span style={{ fontSize: 13, color: "var(--tc-muted)" }}>Secure your account and get receipts by email.</span>
          </span>
          <span style={{ padding: "8px 14px", borderRadius: 10, background: ACCENT, color: "#13171C", fontSize: 13, fontWeight: 800 }}>Verify</span>
        </button>
      )}

      {/* Personal details */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={sectionTitle}>PERSONAL DETAILS</h2>
          <button type="button" onClick={() => setSheet("edit")} style={{ marginBottom: 8, padding: 0, border: "none", background: "transparent", color: ACCENT, fontSize: 14, fontWeight: 800 }}>Edit</button>
        </div>
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ marginTop: -1 }}>
            {detail("Name", me.firstName ?? me.displayName)}
            {detail("Surname", me.lastName ?? "—")}
            {detail("Email", me.email ?? "—", me.email && <Badge ok={me.emailVerified}>{me.emailVerified ? "Verified" : "Not verified"}</Badge>)}
            {detail("Phone number", me.phoneDisplay ?? "—", me.phone && <Badge ok={me.phoneVerified}>{me.phoneVerified ? "Verified" : "Not verified"}</Badge>)}
            {detail("Date of birth", dob)}
          </div>
        </div>
      </section>

      {/* Security & more */}
      <section>
        <h2 style={sectionTitle}>ACCOUNT</h2>
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ marginTop: -1 }}>
            {link("Change password", () => setSheet("password"))}
            {link("My bets", () => navigate("/my-bets"))}
            {link("Customer service", onSupport)}
            {THEMES.includes("d") && link("Switch to classic layout (Theme D)", () => setTheme("d"), "var(--tc-muted)")}
          </div>
        </div>
      </section>

      <button type="button" onClick={() => { logout(); navigate("/", { replace: true }); }} style={{ height: 52, borderRadius: 12, border: "1px solid var(--tc-btn-line)", background: "transparent", color: "var(--tc-text)", fontSize: 15, fontWeight: 800 }}>Log out</button>
      <button type="button" onClick={() => setSheet("delete")} style={{ alignSelf: "center", padding: "6px 10px", border: "none", background: "transparent", color: RED, fontSize: 14, fontWeight: 700 }}>Delete account</button>

      {sheet === "edit" && <EditSheet me={me} onClose={() => setSheet(null)} onSaved={saved} />}
      {sheet === "email" && <VerifyEmailSheet me={me} onClose={() => setSheet(null)} onVerified={saved} />}
      {sheet === "password" && <PasswordSheet onClose={() => setSheet(null)} />}
      {sheet === "delete" && <DeleteSheet onClose={() => setSheet(null)} onDeleted={() => { logout(); navigate("/", { replace: true }); }} />}
    </div>
  );
}
