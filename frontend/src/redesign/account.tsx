// Account page (/account): profile, balance and stats, edit details, verify email, change
// password, log out and delete the account. Edits happen in bottom sheets.
import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api, type Profile } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { THEMES, useTheme } from "../context/ThemeContext";
import { CodeBoxes, formInput, hiddenPw, primaryBtn } from "./auth";
import { CheckIcon, ChevronRight, DepositIcon, GiftIcon, EyeIcon, EyeOffIcon, HeadsetIcon, KeyIcon, ListIcon, LogoutIcon, MailIcon, ReceiptIcon, UserIcon, WithdrawIcon } from "./icons";
import { ON_ACCENT, ACCENT_TEXT, ACCENT, Loader, Sheet, SheetTitle, useMinLoading } from "./shared";

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
            Demo mode — no email is sent. Your code is <strong style={{ color: ACCENT_TEXT, letterSpacing: 2 }}>{sent.demoCode}</strong>
          </p>
        )}
        <CodeBoxes value={code} error={!!error} onChange={(v) => { setCode(v); setError(null); if (v.length === 6) check(v); }} />
        {errorLine(error)}
        <button type="button" onClick={() => check(code)} disabled={busy || code.length !== 6} style={primaryBtn(code.length === 6 && !busy)}>{busy ? "CHECKING…" : "VERIFY EMAIL"}</button>
        <p style={{ margin: 0, fontSize: 14, color: "var(--tc-muted)", textAlign: "center" }}>
          Didn't get it?{" "}
          {wait > 0 ? <span>Resend in 0:{String(wait).padStart(2, "0")}</span>
            : <button type="button" onClick={send} style={{ padding: 0, border: "none", background: "transparent", color: ACCENT_TEXT, fontSize: 14, fontWeight: 800 }}>Resend code</button>}
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

// ---------- personal details & transactions (sheets) ----------
function DetailsSheet({ me, onClose, onEdit, onVerify }: { me: Profile; onClose: () => void; onEdit: () => void; onVerify: () => void }) {
  const dob = me.dateOfBirth ? new Date(`${me.dateOfBirth}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const row = (label: string, value: ReactNode, extra?: ReactNode) => (
    <div style={{ ...rowStyle, cursor: "default" }}>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 12, color: "var(--tc-label)" }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
      </span>
      {extra}
    </div>
  );
  return (
    <Sheet label="Personal details" onClose={onClose}>
      <SheetTitle title="Personal details" onClose={onClose} />
      <div style={{ paddingBottom: 8 }}>
        {row("Name", me.firstName ?? me.displayName)}
        {row("Surname", me.lastName ?? "—")}
        {row("Email", me.email ?? "—", me.email && (me.emailVerified
          ? <Badge ok>Verified</Badge>
          : <button type="button" onClick={onVerify} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT_TEXT, fontSize: 12, fontWeight: 800 }}>Verify</button>))}
        {row("Phone number", me.phoneDisplay ?? "—", me.phone && <Badge ok={me.phoneVerified}>{me.phoneVerified ? "Verified" : "Not verified"}</Badge>)}
        {row("Date of birth", dob)}
      </div>
      <div style={{ padding: "8px 20px 24px" }}>
        <button type="button" onClick={onEdit} style={{ ...primaryBtn(true), width: "100%" }}>EDIT DETAILS</button>
      </div>
    </Sheet>
  );
}

const TX_LABEL: Record<string, string> = {
  BET_STAKE: "Bet placed", BET_PAYOUT: "Bet won", BET_REFUND: "Bet refunded", DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal", BONUS: "Bonus", DEMO_TOPUP: "Demo funds",
};
function TransactionsSheet({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.getTransactions>>["transactions"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.getTransactions().then((r) => setRows(r.transactions)).catch((e) => setError(errText(e))); }, []);
  const loading = useMinLoading(!rows && !error);
  return (
    <Sheet label="Transactions" onClose={onClose}>
      <SheetTitle title="Transactions" onClose={onClose} />
      {loading || (!rows && !error) ? <Loader label="Loading transactions…" compact />
        : error ? <p style={{ margin: 0, padding: "16px 20px", color: "var(--tc-label)" }}>{error}</p>
        : !rows!.length ? <p style={{ margin: 0, padding: "16px 20px 28px", color: "var(--tc-label)", textAlign: "center" }}>No transactions yet.</p>
        : <div style={{ paddingBottom: 16 }}>
            {rows!.map((t) => (
              <div key={t.id} style={{ ...rowStyle, cursor: "default" }}>
                <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{TX_LABEL[t.type] ?? t.type}</span>
                  <span style={{ fontSize: 12, color: "var(--tc-label)" }}>{new Date(t.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: t.amount >= 0 ? GREEN : "var(--tc-text)" }}>{t.amount >= 0 ? "+" : "−"}{naira(Math.abs(t.amount))}</span>
                  {t.balanceAfter !== null && <span style={{ fontSize: 11, color: "var(--tc-label)" }}>Balance {naira(t.balanceAfter)}</span>}
                </span>
              </div>
            ))}
          </div>}
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
  const [sheet, setSheet] = useState<"details" | "edit" | "email" | "password" | "transactions" | "delete" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const loading = useMinLoading(!me && !error);

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
  async function claimBonus() {
    try {
      saved(await api.claimBonus());
      setNote(null);
    } catch (err) {
      setNote(errText(err));
    }
  }

  if (error) return <p style={{ padding: "40px 0", textAlign: "center", color: "var(--tc-label)" }}>{error}</p>;
  if (loading || !me) return <Loader label="Loading your account…" />;

  const fullName = [me.firstName ?? me.displayName, me.lastName].filter(Boolean).join(" ");
  const initials = fullName.split(/\s+/).map((w) => w.replace(/[^A-Za-z0-9]/g, "")[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "P";
  const action = (label: string, icon: ReactNode, onClick?: () => void, soon = false) => (
    <button type="button" onClick={onClick} disabled={!onClick} style={{
      flex: 1, minWidth: 0, padding: "12px 4px 10px", border: "none", borderRadius: 12, background: "var(--tc-raise)",
      color: onClick ? "var(--tc-text)" : "var(--tc-faint)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700,
    }}>
      <span style={{ color: onClick ? ACCENT : "var(--tc-faint)", display: "flex" }}>{icon}</span>
      {label}{soon && <span style={{ fontSize: 10, fontWeight: 700, marginTop: -4 }}>soon</span>}
    </button>
  );
  const item = (icon: ReactNode, label: string, onClick: () => void, right?: ReactNode, color = "var(--tc-text)") => (
    <button type="button" onClick={onClick} style={{ ...rowStyle, color, fontSize: 15, fontWeight: 600 }}>
      <span style={{ display: "flex", color: color === "var(--tc-text)" ? "var(--tc-muted)" : color }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {right}
      <span style={{ display: "flex", color: "var(--tc-faint)" }}><ChevronRight /></span>
    </button>
  );
  const group = (title: string, children: ReactNode) => (
    <section>
      <h2 style={sectionTitle}>{title}</h2>
      <div style={{ ...card, overflow: "hidden" }}><div style={{ marginTop: -1 }}>{children}</div></div>
    </section>
  );
  const statCell = (label: string, value: string, color = "var(--tc-text)") => (
    <div style={{ flex: 1, minWidth: 0, padding: "12px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <span style={{ fontSize: 16, fontWeight: 800, color, whiteSpace: "nowrap" }}>{value}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--tc-label)" }}>{label}</span>
    </div>
  );
  const winnings = me.stats.winnings >= 1_000_000 ? `₦${(me.stats.winnings / 1e6).toFixed(1)}M` : `₦${Math.round(me.stats.winnings).toLocaleString("en-US")}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Who you are + your money */}
      <section style={{ ...card, overflow: "hidden" }}>
        <button type="button" onClick={() => setSheet("details")} style={{ width: "100%", padding: "16px", display: "flex", alignItems: "center", gap: 12, border: "none", background: "transparent", color: "var(--tc-text)", textAlign: "left", font: "inherit" }}>
          <span aria-hidden="true" style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 24, border: `1.5px solid ${ACCENT}`, color: ACCENT_TEXT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800 }}>{initials}</span>
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 17, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fullName}</span>
            <span style={{ fontSize: 13, color: "var(--tc-label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me.phoneDisplay ?? me.email ?? ""}</span>
          </span>
          <span style={{ display: "flex", color: "var(--tc-faint)" }}><ChevronRight /></span>
        </button>
        <div style={{ padding: "14px 16px 16px", borderTop: "1px solid var(--tc-line)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, color: "var(--tc-label)" }}>
              Total balance{me.demo && <span style={{ padding: "1px 6px", borderRadius: 4, background: "var(--tc-raise)", fontSize: 10, letterSpacing: 0.5 }}>DEMO</span>}
            </span>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5 }}>{naira(me.balance)}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {action("Deposit", <DepositIcon />, undefined, true)}
            {action("Withdraw", <WithdrawIcon />, undefined, true)}
            {action("Transactions", <ListIcon />, () => setSheet("transactions"))}
          </div>
          {note && <span role="status" style={{ fontSize: 12, color: "var(--tc-muted)", textAlign: "center" }}>{note}</span>}
        </div>
        {/* Betting at a glance */}
        <div style={{ display: "flex", borderTop: "1px solid var(--tc-line)" }}>
          {statCell("Bets", String(me.stats.bets))}
          <span style={{ width: 1, background: "var(--tc-line)", margin: "10px 0" }} />
          {statCell("Open", String(me.stats.open))}
          <span style={{ width: 1, background: "var(--tc-line)", margin: "10px 0" }} />
          {statCell("Won", String(me.stats.won), me.stats.won ? GREEN : undefined)}
          <span style={{ width: 1, background: "var(--tc-line)", margin: "10px 0" }} />
          {statCell("Winnings", winnings, me.stats.winnings ? GREEN : undefined)}
        </div>
      </section>

      {/* Welcome bonus: one claim, unlocked by verifying the email. */}
      {me.bonus.amount > 0 && !me.bonus.claimed && (
        <section style={{ ...card, padding: 16, display: "flex", alignItems: "center", gap: 14, border: "1px solid rgba(245, 197, 24, 0.45)", background: "linear-gradient(135deg, rgba(245, 197, 24, 0.14), transparent 70%), var(--tc-card)" }}>
          <span aria-hidden="true" style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 22, background: "rgba(245, 197, 24, 0.16)", color: ACCENT_TEXT, display: "flex", alignItems: "center", justifyContent: "center" }}><GiftIcon /></span>
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{naira(me.bonus.amount).replace(".00", "")} welcome bonus</span>
            <span style={{ fontSize: 13, color: "var(--tc-muted)" }}>{me.emailVerified ? "Ready to claim. One per account." : "Verify your email to unlock it."}</span>
          </span>
          <button type="button" onClick={() => (me.emailVerified ? claimBonus() : setSheet("email"))} style={{ flexShrink: 0, height: 40, padding: "0 16px", borderRadius: 10, border: "none", background: ACCENT, color: ON_ACCENT, fontSize: 14, fontWeight: 800 }}>
            {me.emailVerified ? "Claim" : "Verify"}
          </button>
        </section>
      )}

      {group("BETTING", <>
        {item(<ReceiptIcon size={22} />, "My bets", () => navigate("/my-bets"), me.stats.open ? <span style={{ padding: "1px 8px", borderRadius: 999, background: "var(--tc-raise)", fontSize: 12, fontWeight: 800 }}>{me.stats.open} open</span> : undefined)}
        {item(<ListIcon />, "Transactions", () => setSheet("transactions"))}
      </>)}

      {group("PROFILE & SECURITY", <>
        {item(<UserIcon size={22} />, "Personal details", () => setSheet("details"))}
        {me.email && item(<MailIcon />, "Email", () => (me.emailVerified ? setSheet("details") : setSheet("email")), <Badge ok={me.emailVerified}>{me.emailVerified ? "Verified" : "Verify now"}</Badge>)}
        {item(<KeyIcon />, "Change password", () => setSheet("password"))}
      </>)}

      {group("HELP", <>
        {item(<HeadsetIcon size={22} />, "Customer service", onSupport)}
        {THEMES.includes("d") && item(<ListIcon />, "Classic layout (Theme D)", () => setTheme("d"))}
      </>)}

      <section style={{ ...card, overflow: "hidden" }}>
        <div style={{ marginTop: -1 }}>
          {item(<LogoutIcon />, "Log out", () => { logout(); navigate("/", { replace: true }); })}
        </div>
      </section>
      <button type="button" onClick={() => setSheet("delete")} style={{ alignSelf: "center", marginTop: -8, padding: "6px 10px", border: "none", background: "transparent", color: "var(--tc-label)", fontSize: 13, fontWeight: 600, textDecoration: "underline" }}>Delete account</button>

      {sheet === "details" && <DetailsSheet me={me} onClose={() => setSheet(null)} onEdit={() => setSheet("edit")} onVerify={() => setSheet("email")} />}
      {sheet === "edit" && <EditSheet me={me} onClose={() => setSheet(null)} onSaved={saved} />}
      {sheet === "email" && <VerifyEmailSheet me={me} onClose={() => setSheet(null)} onVerified={saved} />}
      {sheet === "password" && <PasswordSheet onClose={() => setSheet(null)} />}
      {sheet === "transactions" && <TransactionsSheet onClose={() => setSheet(null)} />}
      {sheet === "delete" && <DeleteSheet onClose={() => setSheet(null)} onDeleted={() => { logout(); navigate("/", { replace: true }); }} />}
    </div>
  );
}
