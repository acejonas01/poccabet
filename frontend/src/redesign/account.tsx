// Account page (/account): profile, balance and stats, edit details, verify email, change
// password, log out and delete the account. Edits happen in bottom sheets.
import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api, type BankAccount, type Bet, type Profile, type WithdrawInfo, type WithdrawalRow } from "../api/client";
import { useDeviceState } from "../lib/browser";
import { useAuth } from "../context/AuthContext";
import { THEMES, useTheme } from "../context/ThemeContext";
import { CodeBoxes, formInput, hiddenPw, primaryBtn } from "./auth";
import { CheckIcon, ChevronRight, DepositIcon, EyeIcon, EyeOffIcon, HeadsetIcon, KeyIcon, ListIcon, LiveIcon, LogoutIcon, MailIcon, ReceiptIcon, UserIcon, WithdrawIcon } from "./icons";
import { ACCENT, Loader1X2, Sheet, SheetTitle, copyText, useMinLoading } from "./shared";

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

// Small "Copy" button for the customer ID (quoted when contacting support).
function CopyChip({ text, ink }: { text: string; ink?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={async () => { if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 1600); } }}
      style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${ink ? "rgba(19,23,28,0.35)" : "var(--tc-outline-2)"}`, background: "transparent", color: ink ?? (done ? GREEN : "var(--tc-text)"), fontSize: 12, fontWeight: 800 }}>
      {done ? "Copied" : "Copy"}
    </button>
  );
}

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
      <input suppressHydrationWarning type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...formInput(false), paddingRight: 56, ...(show ? {} : hiddenPw) }} />
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
        <Field label="Name"><input suppressHydrationWarning autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={formInput(false)} /></Field>
        <Field label="Surname"><input suppressHydrationWarning autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={formInput(false)} /></Field>
        <Field label="Email"><input suppressHydrationWarning type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} style={formInput(false)} /></Field>
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
      const r = await api.changePassword(current, next);
      if (r.token) localStorage.setItem("token", r.token); // other devices are logged out, not this one
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
          This can't be undone. You'll be logged out everywhere and can't log in again, and your name, phone number and email
          are removed from your account. As the law requires, we keep a sealed record of who you were, your bets and your
          payments for 5 years, then delete it.
        </div>
        <Field label='Type DELETE to confirm'><input suppressHydrationWarning value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" style={formInput(false)} /></Field>
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
        {row("Customer ID", me.customerNo, <CopyChip text={me.customerNo} />)}
        {row("Name", me.firstName ?? me.displayName)}
        {row("Surname", me.lastName ?? "—")}
        {row("Email", me.email ?? "—", me.email && (me.emailVerified
          ? <Badge ok>Verified</Badge>
          : <button type="button" onClick={onVerify} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, fontSize: 12, fontWeight: 800 }}>Verify</button>))}
        {row("Phone number", me.phoneDisplay ?? "—", me.phone && <Badge ok={me.phoneVerified}>{me.phoneVerified ? "Verified" : "Not verified"}</Badge>)}
        {row("Date of birth", dob)}
      </div>
      <div style={{ padding: "8px 20px 24px" }}>
        <button type="button" onClick={onEdit} style={{ ...primaryBtn(true), width: "100%" }}>EDIT DETAILS</button>
      </div>
    </Sheet>
  );
}

// ---------- deposit (Paystack) ----------
// Pick an amount, then pay on Paystack's own page; Paystack sends the player back to
// /account?deposit=<reference>, where the page checks the payment and credits the wallet.
const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];
function DepositSheet({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<Awaited<ReturnType<typeof api.getDepositInfo>> | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.getDepositInfo().then(setInfo).catch((e) => setError(errText(e))); }, []);
  const value = Number(amount.replace(/[^0-9]/g, "")) || 0;
  const ok = !!info?.enabled && value >= info.min && value <= info.max;
  async function pay(e: FormEvent) {
    e.preventDefault();
    if (!info) return;
    if (value < info.min || value > info.max) return setError(`Enter an amount from ₦${info.min.toLocaleString("en-US")} to ₦${info.max.toLocaleString("en-US")}`);
    setBusy(true);
    setError(null);
    try {
      const r = await api.startDeposit(value);
      window.location.href = r.authorizationUrl; // Paystack's secure payment page
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  }
  return (
    <Sheet label="Deposit" onClose={onClose}>
      <SheetTitle title="Deposit" onClose={onClose} />
      {!info && !error ? <Loader1X2 label="Loading…" compact />
        : info && !info.enabled ? <p style={{ ...sheetBody, margin: 0, color: "var(--tc-label)" }}>Deposits aren't available yet. Please check back soon.</p>
        : (
          <form onSubmit={pay} style={sheetBody}>
            {info?.testMode && (
              <p style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: "rgba(245, 197, 24, 0.12)", fontSize: 12.5, lineHeight: 1.5, color: "var(--tc-soft)" }}>
                <strong style={{ color: ACCENT }}>Test mode.</strong> No real money moves. On the Paystack page use the test card <strong>4084 0840 8408 4081</strong>, any future expiry date and CVV <strong>408</strong>.
              </p>
            )}
            <Field label="Amount">
              <span style={{ position: "relative", display: "block" }}>
                <span aria-hidden="true" style={{ position: "absolute", left: 14, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 17, fontWeight: 800, color: "var(--tc-muted)" }}>₦</span>
                <input inputMode="numeric" autoComplete="off" placeholder="0" value={amount ? value.toLocaleString("en-US") : ""}
                  onChange={(e) => { setAmount(e.target.value); setError(null); }} style={{ ...formInput(false), paddingLeft: 34, fontSize: 17, fontWeight: 800 }} />
              </span>
            </Field>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {QUICK_AMOUNTS.map((q) => (
                <button key={q} type="button" onClick={() => { setAmount(String(q)); setError(null); }} style={{
                  height: 34, padding: "0 12px", borderRadius: 17, border: `1px solid ${value === q ? ACCENT : "var(--tc-outline-2)"}`,
                  background: value === q ? "rgba(245, 197, 24, 0.12)" : "transparent", color: value === q ? ACCENT : "var(--tc-text)", fontSize: 13, fontWeight: 800,
                }}>₦{q.toLocaleString("en-US")}</button>
              ))}
            </div>
            {info && <span style={{ fontSize: 12, color: "var(--tc-label)" }}>From ₦{info.min.toLocaleString("en-US")} to ₦{info.max.toLocaleString("en-US")}. You'll pay on Paystack's secure page by card, bank transfer or USSD.</span>}
            {errorLine(error)}
            <button type="submit" disabled={!ok || busy} style={primaryBtn(ok && !busy)}>{busy ? "OPENING PAYSTACK…" : value ? `PAY ₦${value.toLocaleString("en-US")}` : "PAY"}</button>
          </form>
        )}
    </Sheet>
  );
}

// ---------- withdraw ----------
// Add a bank account once (the name comes from the bank), then ask for an amount. The money leaves
// the wallet straight away and is held until an admin pays it (or it comes back).
const W_STATUS: Record<WithdrawalRow["status"], { label: string; color: string }> = {
  PENDING: { label: "Waiting for review", color: ACCENT }, PROCESSING: { label: "On its way to your bank", color: ACCENT },
  PAID: { label: "Paid", color: GREEN }, REJECTED: { label: "Rejected · money returned", color: RED },
  FAILED: { label: "Not paid · money returned", color: RED }, CANCELLED: { label: "Cancelled · money returned", color: "var(--tc-label)" },
};
function BankForm({ current, onSaved, onCancel }: { current: BankAccount | null; onSaved: (b: BankAccount) => void; onCancel?: () => void }) {
  const [banks, setBanks] = useState<{ name: string; code: string }[] | null>(null);
  const [bankCode, setBankCode] = useState(current?.bankCode ?? "");
  const [number, setNumber] = useState("");
  const [found, setFound] = useState<BankAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.getBanks().then((r) => setBanks(r.banks)).catch((e) => setError(errText(e))); }, []);
  // Look the name up as soon as there's a bank and 10 digits.
  useEffect(() => {
    setFound(null);
    if (!bankCode || number.length !== 10) return;
    let live = true;
    setBusy(true); setError(null);
    api.resolveBank(bankCode, number).then((r) => live && setFound(r)).catch((e) => live && setError(errText(e))).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [bankCode, number]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!found) return;
    setBusy(true); setError(null);
    try { onSaved((await api.saveBank(found.bankCode, found.accountNumber)).bank); } catch (err) { setError(errText(err)); setBusy(false); }
  }
  return (
    <form onSubmit={save} style={sheetBody}>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--tc-muted)" }}>Withdrawals are paid into a bank account in your own name.</p>
      <Field label="Bank">
        <select value={bankCode} onChange={(e) => setBankCode(e.target.value)} disabled={!banks} style={{ ...formInput(false), appearance: "auto" }}>
          <option value="">{banks ? "Choose your bank" : "Loading banks…"}</option>
          {banks?.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
        </select>
      </Field>
      <Field label="Account number">
        <input inputMode="numeric" autoComplete="off" maxLength={10} placeholder="10 digits" value={number}
          onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} style={{ ...formInput(false), letterSpacing: 1 }} />
      </Field>
      {busy && !found && number.length === 10 && <span style={{ fontSize: 13, color: "var(--tc-label)" }}>Checking the account…</span>}
      {found && (
        <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(42, 181, 114, 0.12)", fontSize: 14, fontWeight: 800, color: GREEN }}>
          <CheckIcon size={16} />{found.accountName}
        </p>
      )}
      {errorLine(error)}
      <button type="submit" disabled={!found || busy} style={primaryBtn(!!found && !busy)}>{busy && found ? "SAVING…" : "SAVE BANK ACCOUNT"}</button>
      {onCancel && <button type="button" onClick={onCancel} style={{ alignSelf: "center", border: "none", background: "transparent", color: "var(--tc-muted)", fontSize: 14, fontWeight: 700 }}>Keep my current account</button>}
    </form>
  );
}

function WithdrawSheet({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [info, setInfo] = useState<WithdrawInfo | null>(null);
  const [editBank, setEditBank] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = () => api.getWithdrawInfo().then(setInfo).catch((e) => setError(errText(e)));
  useEffect(() => { load(); }, []);
  const value = Number(amount.replace(/[^0-9]/g, "")) || 0;
  const max = info ? Math.min(info.max, Math.floor(info.balance)) : 0;
  const ok = !!info && value >= info.min && value <= max;
  async function withdraw(e: FormEvent) {
    e.preventDefault();
    if (!info) return;
    if (value > info.balance) return setError("That's more than your balance");
    if (value < info.min || value > info.max) return setError(`Enter an amount from ₦${info.min.toLocaleString("en-US")} to ₦${info.max.toLocaleString("en-US")}`);
    setBusy(true); setError(null);
    try { await api.requestWithdrawal(value); setAmount(""); await load(); onChanged(); } catch (err) { setError(errText(err)); }
    finally { setBusy(false); }
  }
  async function cancel(id: string) {
    setBusy(true); setError(null);
    try { await api.cancelWithdrawal(id); await load(); onChanged(); } catch (err) { setError(errText(err)); }
    finally { setBusy(false); }
  }
  const bankLine = (b: { bankName: string; accountNumber: string; accountName: string }) => (
    <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 14, fontWeight: 800 }}>{b.accountName}</span>
      <span style={{ fontSize: 12, color: "var(--tc-label)" }}>{b.bankName} · {b.accountNumber.length > 4 && !b.accountNumber.startsWith("•") ? `••••${b.accountNumber.slice(-4)}` : b.accountNumber}</span>
    </span>
  );
  const boxed: CSSProperties = { padding: "12px 14px", borderRadius: 12, background: "var(--tc-raise)" };
  return (
    <Sheet label="Withdraw" onClose={onClose}>
      <SheetTitle title="Withdraw" onClose={onClose} />
      {!info && !error ? <Loader1X2 label="Loading…" compact />
        : !info ? <p style={{ ...sheetBody, margin: 0, color: "var(--tc-label)" }}>{error}</p>
        : !info.enabled ? <p style={{ ...sheetBody, margin: 0, color: "var(--tc-label)" }}>Withdrawals aren't available yet. Please check back soon.</p>
        : info.open ? (
          // One withdrawal at a time: show where it is.
          <div style={sheetBody}>
            <div style={{ ...boxed, display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 24, fontWeight: 800 }}>{naira(info.open.amount)}</span>
              {bankLine(info.open)}
              <span style={{ fontSize: 13, fontWeight: 800, color: W_STATUS[info.open.status].color }}>{W_STATUS[info.open.status].label}</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--tc-muted)" }}>
              {info.open.status === "PENDING" ? "We check every withdrawal before paying it, usually within 24 hours. You can cancel until then and the money goes back to your wallet." : "Your bank should receive it shortly."}
            </p>
            {errorLine(error)}
            {info.open.status === "PENDING" && (
              <button type="button" onClick={() => cancel(info.open!.id)} disabled={busy} style={{ height: 48, borderRadius: 12, border: "1px solid var(--tc-outline-2)", background: "transparent", color: "var(--tc-text)", fontSize: 15, fontWeight: 800 }}>
                {busy ? "CANCELLING…" : "CANCEL WITHDRAWAL"}
              </button>
            )}
          </div>
        )
        : !info.bank || editBank ? (
          <BankForm current={info.bank} onCancel={info.bank ? () => setEditBank(false) : undefined} onSaved={(b) => { setInfo({ ...info, bank: b }); setEditBank(false); }} />
        ) : (
          <form onSubmit={withdraw} style={sheetBody}>
            {info.testMode && <p style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: "rgba(245, 197, 24, 0.12)", fontSize: 12.5, color: "var(--tc-soft)" }}><strong style={{ color: ACCENT }}>Test mode.</strong> No real money is paid out.</p>}
            <div style={{ ...boxed, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              {bankLine(info.bank)}
              <button type="button" onClick={() => setEditBank(true)} style={{ flexShrink: 0, border: "none", background: "transparent", color: ACCENT, fontSize: 13, fontWeight: 800 }}>Change</button>
            </div>
            <Field label={`Amount (you have ${naira(info.balance)})`}>
              <span style={{ position: "relative", display: "block" }}>
                <span aria-hidden="true" style={{ position: "absolute", left: 14, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: 17, fontWeight: 800, color: "var(--tc-muted)" }}>₦</span>
                <input inputMode="numeric" autoComplete="off" placeholder="0" value={amount ? value.toLocaleString("en-US") : ""}
                  onChange={(e) => { setAmount(e.target.value); setError(null); }} style={{ ...formInput(false), paddingLeft: 34, fontSize: 17, fontWeight: 800 }} />
              </span>
            </Field>
            {max >= info.min && (
              <button type="button" onClick={() => { setAmount(String(max)); setError(null); }} style={{ alignSelf: "flex-start", height: 32, padding: "0 12px", borderRadius: 16, border: "1px solid var(--tc-outline-2)", background: "transparent", color: "var(--tc-text)", fontSize: 13, fontWeight: 800 }}>
                Max ₦{max.toLocaleString("en-US")}
              </button>
            )}
            <span style={{ fontSize: 12, color: "var(--tc-label)" }}>From ₦{info.min.toLocaleString("en-US")} to ₦{info.max.toLocaleString("en-US")}. We check each withdrawal before paying it, usually within 24 hours.</span>
            {errorLine(error)}
            <button type="submit" disabled={!ok || busy} style={primaryBtn(ok && !busy)}>{busy ? "SENDING…" : value ? `WITHDRAW ₦${value.toLocaleString("en-US")}` : "WITHDRAW"}</button>
          </form>
        )}
      {info && info.enabled && info.recent.length > 0 && !(info.recent.length === 1 && info.open) && (
        <div style={{ padding: "0 20px 20px" }}>
          <h3 style={{ ...sectionTitle, marginBottom: 4 }}>RECENT WITHDRAWALS</h3>
          {info.recent.filter((w) => w.id !== info.open?.id).map((w) => (
            <div key={w.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: "1px solid var(--tc-line)" }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{naira(w.amount)}</span>
                <span style={{ fontSize: 12, color: "var(--tc-label)" }}>{new Date(w.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{w.note && w.status === "REJECTED" ? ` · ${w.note}` : ""}</span>
              </span>
              <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: W_STATUS[w.status].color, textAlign: "right" }}>{W_STATUS[w.status].label}</span>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

const TX_LABEL: Record<string, string> = {
  BET_STAKE: "Bet placed", BET_PAYOUT: "Bet won", BET_REFUND: "Bet refunded", DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal", WITHDRAWAL_REVERSAL: "Withdrawal returned", BONUS: "Bonus", DEMO_TOPUP: "Demo funds",
};
function TransactionsSheet({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.getTransactions>>["transactions"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.getTransactions().then((r) => setRows(r.transactions)).catch((e) => setError(errText(e))); }, []);
  const loading = useMinLoading(!rows && !error);
  return (
    <Sheet label="Transactions" onClose={onClose}>
      <SheetTitle title="Transactions" onClose={onClose} />
      {loading || (!rows && !error) ? <Loader1X2 label="Loading transactions…" compact />
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
                  <span style={{ fontSize: 15, fontWeight: 800, color: t.status !== "COMPLETED" ? "var(--tc-label)" : t.amount >= 0 ? GREEN : "var(--tc-text)", textDecoration: t.status === "FAILED" ? "line-through" : "none" }}>{t.amount >= 0 ? "+" : "−"}{naira(Math.abs(t.amount))}</span>
                  {t.status === "PENDING" ? <span style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>Pending</span>
                    : t.status === "FAILED" ? <span style={{ fontSize: 11, fontWeight: 800, color: RED }}>Not completed</span>
                    : t.balanceAfter !== null && <span style={{ fontSize: 11, color: "var(--tc-label)" }}>Balance {naira(t.balanceAfter)}</span>}
                </span>
              </div>
            ))}
          </div>}
    </Sheet>
  );
}

// ---------- the page ----------
// ---------- dashboard pieces (Version B) ----------
type Money = (v: number) => string;
const DAY = 86_400_000;

// Your form: win rate, last 5 results, staked / returns / bets, for 7 days, 30 days or all time.
function FormCard({ bets, box, heading, money }: { bets: Bet[] | null; box: CSSProperties; heading: CSSProperties; money: Money }) {
  const [period, setPeriod] = useState<"7D" | "30D" | "All">("30D");
  const since = period === "All" ? 0 : Date.now() - (period === "7D" ? 7 : 30) * DAY;
  const inPeriod = (bets ?? []).filter((b) => new Date(b.createdAt).getTime() >= since);
  const settled = inPeriod.filter((b) => b.status === "WON" || b.status === "LOST")
    .sort((a, b) => new Date(b.settledAt ?? b.createdAt).getTime() - new Date(a.settledAt ?? a.createdAt).getTime());
  const won = settled.filter((b) => b.status === "WON").length;
  const rate = settled.length ? Math.round((won / settled.length) * 100) : null;
  const last5 = settled.slice(0, 5).reverse(); // oldest → newest, newest on the right
  const staked = inPeriod.reduce((n, b) => n + b.stake, 0);
  const returns = inPeriod.reduce((n, b) => n + (b.status === "WON" ? b.payout ?? 0 : 0), 0);
  const C = 238.8; // ring circumference (r = 38)
  const short = (v: number) => (money(0).includes("•") ? "₦ • • •" : `₦${Math.round(v).toLocaleString("en-US")}`); // whole naira fits the cells
  const cell = (label: string, value: string, last = false) => (
    <div style={{ padding: "12px 16px", borderRight: last ? "none" : "1px solid var(--tc-line)", minWidth: 0 }}>
      <div style={{ fontSize: 12, color: "var(--tc-label)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
    </div>
  );
  return (
    <section aria-label="Your form" style={box}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
        <h2 style={heading}>Your form</h2>
        <div role="tablist" aria-label="Period" style={{ display: "flex", gap: 2 }}>
          {(["7D", "30D", "All"] as const).map((p) => (
            <button key={p} type="button" role="tab" aria-selected={period === p} onClick={() => setPeriod(p)} style={{
              height: 36, minWidth: 48, padding: "0 10px", border: "none", borderBottom: `3px solid ${period === p ? ACCENT : "transparent"}`,
              background: "transparent", color: period === p ? "var(--tc-text)" : "var(--tc-label)", fontSize: 13, fontWeight: 800,
            }}>{p}</button>
          ))}
        </div>
      </div>
      {!bets ? <p style={{ margin: 0, padding: "0 16px 16px", fontSize: 13, color: "var(--tc-label)" }}>Loading your bets…</p>
        : !inPeriod.length ? <p style={{ margin: 0, padding: "0 16px 16px", fontSize: 13, color: "var(--tc-label)" }}>{bets.length ? "No bets in this period." : "Your form shows here after your first bet."}</p>
        : <>
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "4px 16px 16px" }}>
            <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
              <svg width="88" height="88" viewBox="0 0 96 96" aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="48" cy="48" r="38" fill="none" stroke="var(--tc-line)" strokeWidth="10" />
                <circle cx="48" cy="48" r="38" fill="none" stroke={ACCENT} strokeWidth="10" strokeDasharray={C} strokeDashoffset={C * (1 - (rate ?? 0) / 100)} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 26, lineHeight: 1 }}>{rate === null ? "–" : `${rate}%`}</span>
                <span style={{ fontSize: 10, color: "var(--tc-label)", fontWeight: 700 }}>WIN RATE</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "var(--tc-label)", fontWeight: 700, letterSpacing: 0.6 }}>LAST {last5.length || 5} RESULTS</div>
              <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
                {last5.length ? last5.map((b) => (
                  <span key={b.id} title={`${b.ticket}: ${b.status === "WON" ? "won" : "lost"}`} style={{ flex: 1, maxWidth: 52, height: 30, borderRadius: 4, background: b.status === "WON" ? ACCENT : "var(--tc-raise)", color: b.status === "WON" ? "#13171C" : "var(--tc-soft)", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{b.status === "WON" ? "W" : "L"}</span>
                )) : <span style={{ fontSize: 13, color: "var(--tc-label)" }}>No settled bets yet</span>}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderTop: "1px solid var(--tc-line)" }}>
            {cell("Staked", short(staked))}
            {cell("Returns", short(returns))}
            {cell("Bets", String(inPeriod.length), true)}
          </div>
        </>}
    </section>
  );
}

// Open bets: the newest one, with how its legs are going.
const LEG_COLOR: Record<string, string> = { WON: ACCENT, LOST: "#E5484D", VOID: "var(--tc-faint)", PENDING: "var(--tc-outline-strong)" };
function OpenBetCard({ bets, box, heading, money, onAll }: { bets: Bet[] | null; box: CSSProperties; heading: CSSProperties; money: Money; onAll: () => void }) {
  if (!bets) return null;
  const open = bets.filter((b) => b.status === "PENDING");
  const bet = open[0];
  const legs = bet?.selections ?? [];
  const next = legs.find((l) => l.result === "PENDING");
  const kick = next?.kickoff ? new Date(next.kickoff).getTime() : null;
  const live = kick !== null && Date.now() >= kick && Date.now() < kick + 2 * 3600_000;
  const time = kick ? new Date(kick).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <section aria-label="Open bets" style={box}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 16px", borderBottom: bet ? "1px solid var(--tc-line)" : "none" }}>
        <h2 style={heading}>Open bets{open.length > 0 && <span style={{ color: ACCENT }}> · {open.length}</span>}</h2>
        <button type="button" onClick={onAll} style={{ border: "none", background: "transparent", color: ACCENT, fontSize: 14, fontWeight: 700, padding: "12px 0" }}>See all</button>
      </div>
      {!bet ? <p style={{ margin: 0, padding: "0 16px 16px", fontSize: 13, color: "var(--tc-label)" }}>No open bets right now.</p> : <>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 16px 10px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {live && <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 7px", borderRadius: 4, background: "rgba(229, 72, 77, 0.16)", color: "#FF8A7A", letterSpacing: 0.6 }}>● LIVE</span>}
            <span style={{ fontSize: 15, fontWeight: 700 }}>{legs.length > 1 ? `${legs.length}-fold accumulator` : "Single"}</span>
          </span>
          <span style={{ fontSize: 13, color: "var(--tc-label)", fontWeight: 600, flexShrink: 0 }}>{legs.filter((l) => l.result === "WON").length} of {legs.length} won</span>
        </div>
        <div aria-hidden="true" style={{ display: "flex", gap: 4, padding: "0 16px" }}>
          {legs.map((l, i) => <span key={i} style={{ flex: 1, height: 5, borderRadius: 2, background: LEG_COLOR[l.result] ?? LEG_COLOR.PENDING }} />)}
        </div>
        {next && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 14, padding: "12px 16px", background: "var(--tc-page)", borderTop: "1px solid var(--tc-line)", borderBottom: "1px solid var(--tc-line)" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: "var(--tc-label)", fontWeight: 600 }}>{legs.length > 1 ? "Next leg" : "Match"}{time && ` · ${live ? "live now" : time}`}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{next.home} vs {next.away}</div>
              <div style={{ fontSize: 12, color: "var(--tc-soft)", marginTop: 1 }}>{next.marketLabel}: {next.market === "1x2" ? ({ "1": next.home, X: "Draw", "2": next.away } as Record<string, string>)[next.selection] ?? next.selection : next.selection}</div>
            </div>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 26, flexShrink: 0 }}>{next.odds.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 16px" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "var(--tc-label)", fontWeight: 600 }}>Stake {money(bet.stake)} · To win</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT }}>{money(bet.potentialPayout)}</div>
          </div>
          <button type="button" onClick={onAll} style={{ height: 44, padding: "0 18px", borderRadius: 10, border: `1px solid ${ACCENT}`, background: "transparent", color: ACCENT, fontSize: 14, fontWeight: 800, flexShrink: 0 }}>View bet</button>
        </div>
      </>}
    </section>
  );
}

export function RedesignAccount({ onSupport, desktop = false }: { onSupport: () => void; desktop?: boolean }) {
  const navigate = useNavigate();
  const { isAuthenticated, ready, logout, setBalance, updateUser } = useAuth();
  const { setTheme } = useTheme();
  const [me, setMe] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"details" | "edit" | "email" | "password" | "transactions" | "delete" | "deposit" | "withdraw" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [bets, setBets] = useState<Bet[] | null>(null);
  const [spin, setSpin] = useState(0);
  // Hide balance: remembered on this device.
  const [hideMoney, setHideMoney] = useDeviceState(() => localStorage.getItem("pocca-hide-balance") === "1", false);
  const toggleHide = () => setHideMoney((h) => { try { localStorage.setItem("pocca-hide-balance", h ? "0" : "1"); } catch { /* private mode */ } return !h; });
  const loading = useMinLoading(!me && !error);

  useEffect(() => {
    if (!ready) return; // saved login not read yet (a fresh page load, e.g. back from Paystack)
    if (!isAuthenticated) { navigate("/login", { replace: true }); return; }
    api.getMe().then(setMe).catch((err) => {
      if (err instanceof ApiError && err.status === 401) { logout(); navigate("/login", { replace: true }); }
      else setError(errText(err));
    });
  }, [isAuthenticated, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back from Paystack (/account?deposit=<reference>): confirm the payment, then drop it from the address.
  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    const ref = new URLSearchParams(window.location.search).get("deposit");
    if (!ref) return;
    window.history.replaceState(window.history.state, "", window.location.pathname);
    setNote("Confirming your deposit…");
    const check = (tries: number): void => {
      api.checkDeposit(ref).then((r) => {
        if (r.status === "COMPLETED") {
          setNote(`${naira(r.amount ?? 0)} added to your wallet.`);
          if (typeof r.balance === "number") setBalance(r.balance);
          // Fresh profile + header balance: the page's first loads may have raced the credit.
          api.getMe().then((p) => { setMe(p); setBalance(p.balance); }).catch(() => {});
        } else if (r.status === "PENDING" && tries > 0) setTimeout(() => check(tries - 1), 3000); // Paystack may still be finishing
        else if (r.status === "PENDING") setNote("Your payment hasn't been confirmed yet. If you paid, it will show in your wallet shortly.");
        else setNote("The deposit wasn't completed, so nothing was taken from you.");
      }).catch((err) => setNote(errText(err)));
    };
    check(3);
  }, [isAuthenticated, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    api.getMyBets().then((r) => setBets(r.bets)).catch(() => setBets([]));
  }, [isAuthenticated, ready]);
  const refresh = () => {
    setSpin((d) => d + 360);
    Promise.all([api.getMe(), api.getMyBets()]).then(([p, r]) => { setMe(p); setBalance(p.balance); setBets(r.bets); }).catch(() => {});
  };

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
  if (loading || !me) return <Loader1X2 label="Loading your account…" />;

  const firstName = me.firstName ?? me.displayName.split(" ")[0];
  const INK = "#13171C"; // text on the yellow wallet
  // Phones: sections run full width on the dark page, 8px apart; desktop: rounded cards.
  const box: CSSProperties = desktop ? { ...card, overflow: "hidden" } : { background: "var(--tc-card)", margin: "0 -16px" };
  const heading: CSSProperties = { margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 24, lineHeight: 1.1 };
  const money = (v: number) => (hideMoney ? "₦ • • • • •" : naira(v));
  const bonusLocked = me.bonus.amount > 0 && !me.bonus.claimed;
  const openStake = (bets ?? []).filter((b) => b.status === "PENDING").reduce((n, b) => n + b.stake, 0);

  const item = (icon: ReactNode, label: string, onClick: () => void, right?: ReactNode, color = "var(--tc-text)") => (
    <button type="button" onClick={onClick} style={{ ...rowStyle, color, fontSize: 15, fontWeight: 600 }}>
      <span style={{ display: "flex", color: color === "var(--tc-text)" ? "var(--tc-muted)" : color }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {right}
      {color === "var(--tc-text)" && <span style={{ display: "flex", color: "var(--tc-faint)" }}><ChevronRight /></span>}
    </button>
  );
  const quick = (label: string, icon: ReactNode, onClick: () => void, last = false) => (
    <button type="button" onClick={onClick} style={{
      flex: 1, minWidth: 0, padding: "16px 0", border: "none", borderRight: last ? "none" : "1px solid var(--tc-line)", background: "transparent",
      color: "var(--tc-soft)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700,
    }}><span style={{ display: "flex", color: ACCENT }}>{icon}</span>{label}</button>
  );

  return (
    <div className={desktop ? undefined : "tc-account-page"} style={{ display: "flex", flexDirection: "column", gap: desktop ? 16 : 8, marginTop: desktop ? 0 : -16 }}>
      {/* Wallet: a yellow betting ticket with a torn edge */}
      <section aria-label="Your wallet" style={{ ...box, background: ACCENT, color: INK, position: "relative", paddingBottom: 26, overflow: desktop ? "hidden" : "visible" }}>
        <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <button type="button" onClick={() => setSheet("details")} style={{ border: "none", background: "transparent", color: INK, padding: 0, fontSize: 15, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Hi, {firstName}</button>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
            {me.customerNo}<CopyChip text={me.customerNo} ink={INK} />
          </span>
        </div>
        <div style={{ padding: "14px 16px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.8 }}>TOTAL BALANCE</span>
          {me.demo && <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 7px", borderRadius: 5, background: INK, color: ACCENT, letterSpacing: 0.8 }}>DEMO</span>}
          <button type="button" onClick={toggleHide} aria-label={hideMoney ? "Show balance" : "Hide balance"} style={{ width: 44, height: 44, margin: "-12px 0 -12px -6px", border: "none", background: "transparent", color: INK, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {hideMoney ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
          </button>
          <button type="button" onClick={refresh} aria-label="Refresh balance" style={{ width: 44, height: 44, margin: "-12px 0 -12px -12px", border: "none", background: "transparent", color: INK, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: `rotate(${spin}deg)`, transition: "transform .6s" }}><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></svg>
          </button>
        </div>
        <div style={{ padding: "2px 16px 0", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 40, lineHeight: 1.05, letterSpacing: -0.3 }}>{money(me.balance)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 16, borderTop: "1px solid rgba(19,23,28,0.18)", borderBottom: "1px solid rgba(19,23,28,0.18)" }}>
          <div style={{ padding: "12px 16px", borderRight: "1px solid rgba(19,23,28,0.18)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.75 }}>In open bets</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{bets ? money(openStake) : "…"}</div>
          </div>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.75 }}>{bonusLocked ? "Bonus · locked" : "Total winnings"}</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{money(bonusLocked ? me.bonus.amount : me.stats.winnings)}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, padding: "16px 16px 0" }}>
          <button type="button" onClick={() => setSheet("deposit")} style={{ height: 54, borderRadius: 12, border: "none", background: INK, color: ACCENT, fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><DepositIcon size={20} />Deposit</button>
          <button type="button" onClick={() => setSheet("withdraw")} style={{ height: 54, borderRadius: 12, border: `2px solid ${INK}`, background: "transparent", color: INK, fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><WithdrawIcon size={20} />Withdraw</button>
        </div>
        {note && <p role="status" style={{ margin: "12px 16px 0", fontSize: 13, fontWeight: 700, textAlign: "center" }}>{note}</p>}
        {/* torn ticket edge: circles in the page colour along the bottom */}
        <div aria-hidden="true" style={{ position: "absolute", left: -4, right: -4, bottom: -7, display: "flex", justifyContent: "space-between", overflow: "hidden" }}>
          {Array.from({ length: 22 }, (_, i) => <span key={i} style={{ width: 14, height: 14, flexShrink: 0, borderRadius: 7, background: desktop ? "var(--tc-page)" : "var(--tc-league)" }} />)}
        </div>
      </section>

      {/* Quick actions */}
      <nav aria-label="Quick actions" style={{ ...box, display: "flex" }}>
        {quick("Transactions", <ListIcon size={24} />, () => setSheet("transactions"))}
        {quick("My bets", <ReceiptIcon size={24} />, () => navigate("/my-bets"))}
        {quick("Live", <LiveIcon size={24} />, () => navigate("/sports/football/live"))}
        {quick("Help", <HeadsetIcon size={24} />, onSupport, true)}
      </nav>

      {/* Welcome bonus: account ✓ → verify email → claim */}
      {bonusLocked && (
        <section aria-label="Welcome bonus" style={{ ...box, background: "#262416", color: "var(--tc-text)" }}>
          <div style={{ height: 4, background: "#3E3920" }}><div style={{ width: me.emailVerified ? "66%" : "33%", height: 4, background: ACCENT }} /></div>
          <div style={{ padding: 16, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
            <h2 style={heading}>Unlock your <span style={{ color: ACCENT }}>{naira(me.bonus.amount).replace(".00", "")}</span> bonus</h2>
            <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT, flexShrink: 0 }}>{me.emailVerified ? 2 : 1} of 3</span>
          </div>
          {([
            { label: "Create your account", done: true },
            { label: "Verify your email", done: me.emailVerified, action: me.emailVerified ? null : { text: "Verify", run: () => setSheet(me.email ? "email" : "edit") } },
            { label: "Claim your bonus", done: false, action: me.emailVerified ? { text: "Claim", run: claimBonus } : null },
          ] as { label: string; done: boolean; action?: { text: string; run: () => void } | null }[]).map((st, i) => (
            <div key={st.label} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 54, padding: "0 16px", borderTop: "1px solid #3A3620" }}>
              <span aria-hidden="true" style={{ width: 24, height: 24, flexShrink: 0, boxSizing: "border-box", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, ...(st.done ? { background: ACCENT, color: INK } : { border: `2px solid ${st.action ? ACCENT : "#6A6445"}`, color: st.action ? ACCENT : "#BDB9A0" }) }}>
                {st.done ? <CheckIcon size={13} /> : i + 1}
              </span>
              <span style={{ flex: 1, fontSize: 15, fontWeight: st.action ? 700 : 600, color: st.done ? "#A9A68E" : "var(--tc-text)", textDecoration: st.done ? "line-through" : "none" }}>{st.label}</span>
              {st.action && <button type="button" onClick={st.action.run} style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "none", background: ACCENT, color: INK, fontSize: 14, fontWeight: 800 }}>{st.action.text}</button>}
            </div>
          ))}
        </section>
      )}

      <FormCard bets={bets} box={box} heading={heading} money={money} />
      <OpenBetCard bets={bets} box={box} heading={heading} money={money} onAll={() => navigate("/my-bets")} />

      {/* Play responsibly */}
      <button type="button" onClick={onSupport} style={{ ...box, border: box.border ?? "none", display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", color: "var(--tc-text)", textAlign: "left", font: "inherit" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2AB572" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Play responsibly</span>
          <span style={{ fontSize: 13, color: "var(--tc-label)" }}>18+ only. Need a break or help? Talk to us.</span>
        </span>
        <span style={{ display: "flex", color: "var(--tc-faint)" }}><ChevronRight /></span>
      </button>

      {/* Account */}
      <section aria-label="Account" style={box}>
        <h2 style={{ margin: 0, padding: "14px 16px 8px", fontSize: 12, fontWeight: 800, color: "var(--tc-label)", letterSpacing: 1.2 }}>ACCOUNT</h2>
        {item(<UserIcon size={20} />, "Personal details", () => setSheet("details"))}
        {me.email && item(<MailIcon />, "Email", () => (me.emailVerified ? setSheet("details") : setSheet("email")), <Badge ok={me.emailVerified}>{me.emailVerified ? "Verified" : "Unverified"}</Badge>)}
        {item(<KeyIcon />, "Password & security", () => setSheet("password"))}
        {item(<HeadsetIcon size={20} />, "Help & support", onSupport)}
        {THEMES.includes("d") && item(<ListIcon />, "Classic layout (Theme D)", () => setTheme("d"))}
        {item(<LogoutIcon />, "Log out", () => { logout(); navigate("/", { replace: true }); }, undefined, "#FF8A7A")}
      </section>
      <button type="button" onClick={() => setSheet("delete")} style={{ alignSelf: "center", padding: "6px 10px", border: "none", background: "transparent", color: "var(--tc-label)", fontSize: 13, fontWeight: 600, textDecoration: "underline" }}>Delete account</button>
      <p style={{ margin: "-4px 0 0", textAlign: "center", fontSize: 12, color: "var(--tc-faint)" }}>18+ only · Bet responsibly</p>

      {sheet === "details" && <DetailsSheet me={me} onClose={() => setSheet(null)} onEdit={() => setSheet("edit")} onVerify={() => setSheet("email")} />}
      {sheet === "edit" && <EditSheet me={me} onClose={() => setSheet(null)} onSaved={saved} />}
      {sheet === "email" && <VerifyEmailSheet me={me} onClose={() => setSheet(null)} onVerified={saved} />}
      {sheet === "password" && <PasswordSheet onClose={() => setSheet(null)} />}
      {sheet === "deposit" && <DepositSheet onClose={() => setSheet(null)} />}
      {sheet === "withdraw" && <WithdrawSheet onClose={() => setSheet(null)} onChanged={() => api.getMe().then(saved).catch(() => {})} />}
      {sheet === "transactions" && <TransactionsSheet onClose={() => setSheet(null)} />}
      {sheet === "delete" && <DeleteSheet onClose={() => setSheet(null)} onDeleted={() => { logout(); navigate("/", { replace: true }); }} />}
    </div>
  );
}
