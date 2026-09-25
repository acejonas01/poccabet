// Sign-up (phone → SMS code → password) and log-in for the redesign (Themes A–C).
// Full-screen on phones, a centred card on desktop.
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ChevronLeft, CloseIcon } from "./icons";
import { Flag } from "./media";
import { ACCENT, WELCOME_BONUS_AMOUNT } from "./shared";

const barlow = "'Barlow Condensed', 'Arial Narrow', sans-serif";
const errText = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong. Please try again.");

// "08030999969" / "+2348030999969" → the 10 digits after +234, grouped "803 099 9969".
const localDigits = (v: string) => {
  let d = v.replace(/\D/g, "");
  if (d.startsWith("234")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 10);
};
const grouped = (d: string) => [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(" ");
const validLocal = (d: string) => /^[789][01]\d{8}$/.test(d);

// ---------- shared pieces ----------
function Shell({ children, onClose, banner }: { children: ReactNode; onClose: () => void; banner?: ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "var(--tc-page)" }}>
      <div style={{ position: "relative", padding: "calc(16px + env(safe-area-inset-top)) 20px 44px", background: "radial-gradient(120% 90% at 50% 0%, rgba(245, 197, 24, 0.18), transparent 65%), var(--tc-league)", textAlign: "center" }}>
        <button aria-label="Close" onClick={onClose} style={{ position: "absolute", top: "calc(10px + env(safe-area-inset-top))", right: 10, width: 44, height: 44, border: "none", background: "transparent", color: "var(--tc-text)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CloseIcon size={20} />
        </button>
        <div style={{ fontFamily: barlow, fontStyle: "italic", fontWeight: 700, fontSize: 30, lineHeight: 1 }}>Pocca<span style={{ color: ACCENT }}>bet</span></div>
        {banner}
      </div>
      <div style={{ flex: 1, marginTop: -24, padding: "28px 20px calc(28px + env(safe-area-inset-bottom))", borderRadius: "22px 22px 0 0", background: "var(--tc-panel)", display: "flex", flexDirection: "column", gap: 18 }}>
        {children}
      </div>
    </div>
  );
}

function WelcomeBanner() {
  return (
    <div style={{ marginTop: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ fontFamily: barlow, fontStyle: "italic", fontWeight: 700, fontSize: 34, lineHeight: 1, letterSpacing: 0.5 }}>
        WELCOME <span style={{ color: ACCENT }}>OFFER</span>
      </div>
      <div style={{ width: "100%", maxWidth: 340, padding: "14px 16px", borderRadius: 14, background: "rgba(0, 0, 0, 0.25)", border: "1px solid rgba(245, 197, 24, 0.3)", display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontFamily: barlow, fontWeight: 700, fontSize: 22, lineHeight: 1.1 }}>
          UP TO <span style={{ color: ACCENT }}>{WELCOME_BONUS_AMOUNT}</span> BONUS
        </span>
        <span style={{ fontSize: 13, color: "var(--tc-soft)" }}>on your first deposit · football, Aviator & more</span>
      </div>
    </div>
  );
}

const primaryBtn = (enabled: boolean): CSSProperties => ({
  height: 54, borderRadius: 27, border: "none", background: enabled ? ACCENT : "var(--tc-raise)",
  color: enabled ? "#13171C" : "var(--tc-faint)", fontSize: 16, fontWeight: 800, letterSpacing: 0.6,
});
const errorLine = (msg: string | null) => msg && <p role="alert" style={{ margin: 0, fontSize: 13, color: "#E5484D", textAlign: "center" }}>{msg}</p>;
const fieldBox: CSSProperties = { display: "flex", alignItems: "stretch", borderRadius: "12px 12px 0 0", background: "var(--tc-page)", borderBottom: "2px solid var(--tc-outline-strong)" };
const smallLabel: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--tc-label)" };
const textInput: CSSProperties = { width: "100%", minWidth: 0, padding: 0, background: "transparent", border: "none", outline: "none", color: "var(--tc-text)", fontFamily: "inherit", fontSize: 20, fontWeight: 600 };

function PhoneField({ digits, onChange, autoFocus }: { digits: string; onChange: (d: string) => void; autoFocus?: boolean }) {
  return (
    <label style={fieldBox}>
      <span style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 10px 14px", borderRight: "1px solid var(--tc-line)" }}>
        <Flag country="Nigeria" size={22} />
        <span style={{ display: "flex", flexDirection: "column" }}>
          <span style={smallLabel}>Int. code</span>
          <span style={{ fontSize: 18, fontWeight: 600, color: "var(--tc-muted)" }}>+234</span>
        </span>
      </span>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "10px 14px" }}>
        <span style={smallLabel}>Phone number</span>
        <input type="tel" inputMode="numeric" autoComplete="tel-national" autoFocus={autoFocus} placeholder="803 000 0000"
          value={grouped(digits)} onChange={(e) => onChange(localDigits(e.target.value))} style={textInput} />
      </span>
    </label>
  );
}

function PasswordField({ value, onChange, label, autoComplete }: { value: string; onChange: (v: string) => void; label: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <label style={{ ...fieldBox, alignItems: "center" }}>
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: "10px 14px" }}>
        <span style={smallLabel}>{label}</span>
        <input type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...textInput, fontSize: 18 }} />
      </span>
      <button type="button" onClick={() => setShow((s) => !s)} style={{ height: 44, padding: "0 14px", border: "none", background: "transparent", color: ACCENT, fontSize: 13, fontWeight: 800 }}>
        {show ? "Hide" : "Show"}
      </button>
    </label>
  );
}

// ---------- sign-up ----------
export function RedesignSignup() {
  const navigate = useNavigate();
  const { signupWithPhone } = useAuth();
  const [step, setStep] = useState<"phone" | "code" | "password">("phone");
  const [digits, setDigits] = useState("");
  const [hasReferral, setHasReferral] = useState(false);
  const [referral, setReferral] = useState("");
  const [sent, setSent] = useState<{ phone: string; display: string; demoCode?: string } | null>(null);
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0); // seconds until "Resend code"
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const close = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate("/"));

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    if (!validLocal(digits) || busy) return setError(validLocal(digits) ? null : "Enter a valid Nigerian mobile number");
    setBusy(true);
    setError(null);
    try {
      const res = await api.otpStart(digits);
      setSent(res);
      setWait(res.resendIn);
      setCode("");
      setStep("code");
      setTimeout(() => codeInput.current?.focus(), 50);
    } catch (err) {
      if (err instanceof ApiError && err.code === "TOO_SOON" && sent) {
        setStep("code"); // a code is already on its way
      }
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function checkCode(value = code) {
    if (value.length !== 6 || busy || !sent) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.otpVerify(sent.phone, value);
      setToken(res.verificationToken);
      setStep("password");
    } catch (err) {
      setError(errText(err));
      setCode("");
      codeInput.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8 || busy) return setError(password.length < 8 ? "Use at least 8 characters" : null);
    setBusy(true);
    setError(null);
    try {
      await signupWithPhone({ verificationToken: token, password, displayName: name.trim() || undefined, referralCode: hasReferral ? referral.trim() || undefined : undefined });
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "VERIFICATION_EXPIRED") setStep("phone");
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  const backBtn = (to: () => void, label: string) => (
    <button type="button" onClick={to} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 4, height: 36, padding: 0, border: "none", background: "transparent", color: "var(--tc-muted)", fontSize: 14, fontWeight: 700 }}>
      <ChevronLeft size={16} />{label}
    </button>
  );

  // 1) phone number
  if (step === "phone") {
    return (
      <Shell onClose={close} banner={<WelcomeBanner />}>
        <form onSubmit={sendCode} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--tc-soft)", textAlign: "center" }}>Join for that Poccabet feeling!</h1>
          <PhoneField digits={digits} onChange={(d) => { setDigits(d); setError(null); }} autoFocus />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span id="ref-label" style={{ fontSize: 16, color: "var(--tc-text)" }}>Do you have a referral code?</span>
            <button type="button" role="switch" aria-checked={hasReferral} aria-labelledby="ref-label" onClick={() => setHasReferral((v) => !v)} style={{
              position: "relative", width: 52, height: 30, flexShrink: 0, borderRadius: 15, border: "none", padding: 0,
              background: hasReferral ? ACCENT : "var(--tc-track)", transition: "background 0.15s",
            }}>
              <span style={{ position: "absolute", top: 3, left: hasReferral ? 25 : 3, width: 24, height: 24, borderRadius: 12, background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left 0.15s" }} />
            </button>
          </div>
          {hasReferral && (
            <label style={fieldBox}>
              <span style={{ flex: 1, display: "flex", flexDirection: "column", padding: "10px 14px" }}>
                <span style={smallLabel}>Referral code</span>
                <input value={referral} onChange={(e) => setReferral(e.target.value.toUpperCase())} autoCapitalize="characters" style={{ ...textInput, fontSize: 18 }} />
              </span>
            </label>
          )}
          {errorLine(error)}
          <button type="submit" disabled={busy} style={primaryBtn(validLocal(digits) && !busy)}>{busy ? "SENDING CODE…" : "GET STARTED"}</button>
          <p style={{ margin: 0, fontSize: 14, color: "var(--tc-muted)", textAlign: "center" }}>
            Already have an account? <a href="/login" onClick={(e) => { e.preventDefault(); navigate("/login", { replace: true }); }} style={{ fontWeight: 800 }}>Log in</a>
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--tc-label)", textAlign: "center" }}>18+ only · Please play responsibly</p>
        </form>
      </Shell>
    );
  }

  // 2) the code
  if (step === "code" && sent) {
    return (
      <Shell onClose={close}>
        {backBtn(() => { setStep("phone"); setError(null); }, "Change number")}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Verify your number</h1>
          <p style={{ margin: 0, fontSize: 15, color: "var(--tc-muted)" }}>Enter the 6-digit code we sent to <strong style={{ color: "var(--tc-text)" }}>{sent.display}</strong></p>
        </div>
        {sent.demoCode && (
          <p style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: "rgba(245, 197, 24, 0.12)", border: "1px solid rgba(245, 197, 24, 0.35)", fontSize: 13, color: "var(--tc-soft)" }}>
            Demo mode — no SMS is sent. Your code is <strong style={{ color: ACCENT, letterSpacing: 2 }}>{sent.demoCode}</strong>
          </p>
        )}
        {/* One real input (so the phone can fill the code from the SMS), drawn as 6 boxes. */}
        <label style={{ position: "relative", display: "block" }}>
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Verification code</span>
          <input ref={codeInput} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} autoFocus
            value={code} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); setError(null); if (v.length === 6) checkCode(v); }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, fontSize: 16, border: "none" }} />
          <span aria-hidden="true" style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8 }}>
            {Array.from({ length: 6 }, (_, i) => {
              const active = i === Math.min(code.length, 5);
              return (
                <span key={i} style={{
                  height: 58, borderRadius: 12, background: "var(--tc-page)", border: `2px solid ${error ? "#E5484D" : active ? ACCENT : "var(--tc-outline)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: barlow, fontSize: 30, fontWeight: 700,
                }}>{code[i] ?? ""}</span>
              );
            })}
          </span>
        </label>
        {errorLine(error)}
        <button type="button" onClick={() => checkCode()} disabled={busy || code.length !== 6} style={primaryBtn(code.length === 6 && !busy)}>{busy ? "CHECKING…" : "VERIFY"}</button>
        <p style={{ margin: 0, fontSize: 14, color: "var(--tc-muted)", textAlign: "center" }}>
          Didn't get it?{" "}
          {wait > 0
            ? <span>Resend in 0:{String(wait).padStart(2, "0")}</span>
            : <button type="button" onClick={() => sendCode()} style={{ padding: 0, border: "none", background: "transparent", color: ACCENT, fontSize: 14, fontWeight: 800 }}>Resend code</button>}
        </p>
      </Shell>
    );
  }

  // 3) password (+ optional name)
  return (
    <Shell onClose={close}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#2AB572" }}>✓ Number verified</span>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Secure your account</h1>
        <p style={{ margin: 0, fontSize: 15, color: "var(--tc-muted)" }}>You'll log in with {sent?.display} and this password.</p>
      </div>
      <form onSubmit={create} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label style={fieldBox}>
          <span style={{ flex: 1, display: "flex", flexDirection: "column", padding: "10px 14px" }}>
            <span style={smallLabel}>Your name (optional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40} style={{ ...textInput, fontSize: 18 }} />
          </span>
        </label>
        <PasswordField value={password} onChange={(v) => { setPassword(v); setError(null); }} label="Create a password" autoComplete="new-password" />
        <span style={{ fontSize: 12, color: password.length >= 8 ? "#2AB572" : "var(--tc-label)" }}>{password.length >= 8 ? "✓ " : ""}At least 8 characters</span>
        {errorLine(error)}
        <button type="submit" disabled={busy} style={primaryBtn(password.length >= 8 && !busy)}>{busy ? "CREATING ACCOUNT…" : "CREATE ACCOUNT"}</button>
      </form>
    </Shell>
  );
}

// ---------- log in ----------
export function RedesignLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [useEmail, setUseEmail] = useState(false); // older accounts signed up with an email
  const [digits, setDigits] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate("/"));
  const ready = (useEmail ? email.includes("@") : validLocal(digits)) && password.length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(useEmail ? email : `+234${digits}`, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell onClose={close} banner={<p style={{ margin: "12px 0 0", fontSize: 15, color: "var(--tc-soft)" }}>Welcome back</p>}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Log in</h1>
        {useEmail ? (
          <label style={fieldBox}>
            <span style={{ flex: 1, display: "flex", flexDirection: "column", padding: "10px 14px" }}>
              <span style={smallLabel}>Email</span>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...textInput, fontSize: 18 }} />
            </span>
          </label>
        ) : (
          <PhoneField digits={digits} onChange={(d) => { setDigits(d); setError(null); }} autoFocus />
        )}
        <PasswordField value={password} onChange={(v) => { setPassword(v); setError(null); }} label="Password" autoComplete="current-password" />
        {errorLine(error)}
        <button type="submit" disabled={busy} style={primaryBtn(ready && !busy)}>{busy ? "LOGGING IN…" : "LOG IN"}</button>
        <p style={{ margin: 0, fontSize: 14, color: "var(--tc-muted)", textAlign: "center" }}>
          New to Poccabet? <a href="/signup" onClick={(e) => { e.preventDefault(); navigate("/signup", { replace: true }); }} style={{ fontWeight: 800 }}>Create an account</a>
        </p>
        <button type="button" onClick={() => { setUseEmail((v) => !v); setError(null); }} style={{ alignSelf: "center", padding: 0, border: "none", background: "transparent", color: "var(--tc-label)", fontSize: 13, fontWeight: 700 }}>
          {useEmail ? "Log in with your phone number" : "Signed up with an email? Log in with email"}
        </button>
      </form>
    </Shell>
  );
}
