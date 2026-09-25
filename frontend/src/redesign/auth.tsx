// Sign-up (phone → SMS code → password) and log-in for the redesign (Themes A–C).
// Full-screen on phones, a centred card on desktop.
import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { CheckIcon, ChevronLeft, CloseIcon, EyeIcon, EyeOffIcon } from "./icons";
import { Flag } from "./media";
import { PlayResponsibly } from "./footer";
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
// `image`: a photo behind the top section, fading into the page (log-in hero).
function Shell({ children, onClose, banner, image }: { children: ReactNode; onClose: () => void; banner?: ReactNode; image?: string }) {
  // The page behind these screens takes the form's colour, so no darker strip shows below the
  // form on phones where the visible screen is taller than the content (e.g. iPhone toolbars).
  useEffect(() => {
    if (window.innerWidth >= 900) return; // desktop shows these as a card on the normal page
    const prev = document.body.style.background;
    document.body.style.background = "var(--tc-panel)";
    return () => { document.body.style.background = prev; };
  }, []);
  return (
    <div className="tc-auth-shell" style={{ display: "flex", flexDirection: "column", background: "var(--tc-panel)" }}>
      <div style={{
        position: "relative", padding: `calc(16px + env(safe-area-inset-top)) 20px ${image ? 48 : 44}px`, textAlign: "center",
        background: image
          ? `linear-gradient(180deg, rgba(8, 12, 15, 0.35) 0%, rgba(8, 12, 15, 0.15) 35%, var(--tc-panel) 100%), url(${image}) center 20% / cover`
          : "radial-gradient(120% 90% at 50% 0%, rgba(245, 197, 24, 0.18), transparent 65%), var(--tc-league)",
      }}>
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
        <input type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} style={{ ...textInput, fontSize: 18, ...(show ? {} : hiddenPw) }} />
      </span>
      <button type="button" onClick={() => setShow((s) => !s)} style={{ height: 44, padding: "0 14px", border: "none", background: "transparent", color: ACCENT, fontSize: 13, fontWeight: 800 }}>
        {show ? "Hide" : "Show"}
      </button>
    </label>
  );
}

// ---------- sign-up: phone number → SMS code → your details → Congratulations ----------
const formInput = (bad: boolean): CSSProperties => ({
  width: "100%", height: 52, boxSizing: "border-box", padding: "0 16px", borderRadius: 10,
  border: `1.5px solid ${bad ? "#E5484D" : "transparent"}`, background: "var(--tc-raise)", outline: "none",
  color: "var(--tc-text)", fontFamily: "inherit", fontSize: 17,
});
// Hidden passwords: the phone's own font at 16px gives normal-sized dots (our font draws huge ones;
// 16px is the smallest size that doesn't make iPhones zoom in).
const hiddenPw: CSSProperties = { fontSize: 16, fontFamily: "-apple-system, system-ui, sans-serif", letterSpacing: 2 };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function FormField({ label, error, children }: { label: string; error?: string | null; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 16, color: "var(--tc-text)" }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 13, color: "#E5484D" }}>{error}</span>}
    </label>
  );
}

export function RedesignSignup() {
  const navigate = useNavigate();
  const { signupWithPhone, balance, demo } = useAuth();
  const [step, setStep] = useState<"phone" | "code" | "details" | "dob" | "done">("phone");
  const [dob, setDob] = useState({ day: "", month: "", year: "" });
  const [hasPromo, setHasPromo] = useState(false);
  const [token, setToken] = useState("");
  const [f, setF] = useState({ firstName: "", lastName: "", digits: "", email: "", password: "", promo: "", over18: false });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPw, setShowPw] = useState(false);
  const [sent, setSent] = useState<{ phone: string; display: string; demoCode?: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0); // seconds until "Resend code"
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const set = (k: keyof typeof f) => (v: string | boolean) => { setF((x) => ({ ...x, [k]: v })); setError(null); };
  const touch = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  const problems = {
    firstName: f.firstName.trim().length < 2 ? "Enter your name" : null,
    lastName: f.lastName.trim().length < 2 ? "Enter your surname" : null,
    email: !EMAIL_RE.test(f.email.trim()) ? "Enter a valid email" : null,
    password: f.password.length < 8 ? "Use at least 8 characters" : null,
    over18: !f.over18 ? "You must be over 18 to open an account" : null,
  };
  const valid = Object.values(problems).every((p) => !p); // the details step
  const phoneOk = validLocal(f.digits);
  const shown = (k: keyof typeof problems) => (touched[k] ? problems[k] : null);
  const close = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate("/"));

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    if (!phoneOk || busy) return setError(phoneOk ? null : "Enter a valid Nigerian mobile number");
    setBusy(true);
    setError(null);
    try {
      const res = await api.otpStart(f.digits);
      setSent(res);
      setWait(res.resendIn);
      setCode("");
      setStep("code");
      setTimeout(() => codeInput.current?.focus(), 50);
    } catch (err) {
      if (err instanceof ApiError && err.code === "TOO_SOON" && sent) setStep("code"); // a code is already on its way
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
      setToken((await api.otpVerify(sent.phone, value)).verificationToken);
      setStep("details");
    } catch (err) {
      setCode("");
      codeInput.current?.focus();
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  function toDob(e: FormEvent) {
    e.preventDefault();
    if (!valid) return setTouched({ firstName: true, lastName: true, email: true, password: true, over18: true });
    setError(null);
    setStep("dob");
  }

  // Date of birth → age (whole years), or null until all three are picked.
  const dobIso = dob.day && dob.month && dob.year ? `${dob.year}-${dob.month.padStart(2, "0")}-${dob.day.padStart(2, "0")}` : "";
  const age = (() => {
    if (!dobIso) return null;
    const [y, m, d] = dobIso.split("-").map(Number);
    const born = new Date(y, m - 1, d);
    if (born.getMonth() !== m - 1) return -1; // e.g. 31 February
    const now = new Date();
    return now.getFullYear() - y - (now.getMonth() < m - 1 || (now.getMonth() === m - 1 && now.getDate() < d) ? 1 : 0);
  })();
  const dobProblem = age === null ? null : age < 0 ? "That date doesn't exist" : age < 18 ? "You must be 18 or older to open an account" : null;

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!dobIso || dobProblem || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signupWithPhone({
        verificationToken: token, firstName: f.firstName.trim(), lastName: f.lastName.trim(), email: f.email.trim(),
        password: f.password, ageConfirmed: true, dateOfBirth: dobIso, referralCode: hasPromo ? f.promo.trim() || undefined : undefined,
      });
      setStep("done");
    } catch (err) {
      // Verification ran out (15 min) or the number got taken meanwhile: start again from the number.
      if (err instanceof ApiError && (err.code === "VERIFICATION_EXPIRED" || err.code === "PHONE_TAKEN")) setStep("phone");
      else if (err instanceof ApiError && (err.code === "EMAIL_TAKEN" || err.code === "INVALID_DETAILS")) setStep("details");
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  // 1) phone number (the lively first screen)
  if (step === "phone") {
    return (
      <Shell onClose={close} banner={<WelcomeBanner />}>
        <form onSubmit={sendCode} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--tc-soft)", textAlign: "center" }}>Join for that Poccabet feeling!</h1>
          <PhoneField digits={f.digits} onChange={(d) => set("digits")(d)} autoFocus />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span id="promo-label" style={{ fontSize: 16 }}>Do you have a promotion code?</span>
            <button type="button" role="switch" aria-checked={hasPromo} aria-labelledby="promo-label" onClick={() => setHasPromo((v) => !v)} style={{
              position: "relative", width: 52, height: 30, flexShrink: 0, borderRadius: 15, border: "none", padding: 0,
              background: hasPromo ? ACCENT : "var(--tc-track)", transition: "background 0.15s",
            }}>
              <span style={{ position: "absolute", top: 3, left: hasPromo ? 25 : 3, width: 24, height: 24, borderRadius: 12, background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left 0.15s" }} />
            </button>
          </div>
          {hasPromo && (
            <input aria-label="Promotion code" placeholder="Promotion code" autoCapitalize="characters" value={f.promo} onChange={(e) => set("promo")(e.target.value.toUpperCase())} style={formInput(false)} />
          )}
          {errorLine(error)}
          <button type="submit" disabled={busy} style={primaryBtn(phoneOk && !busy)}>{busy ? "SENDING CODE…" : "GET STARTED"}</button>
          <p style={{ margin: 0, fontSize: 14, color: "var(--tc-muted)", textAlign: "center" }}>
            Already have an account? <a href="/login" onClick={(e) => { e.preventDefault(); navigate("/login", { replace: true }); }} style={{ fontWeight: 800 }}>Log in</a>
          </p>
          <PlayResponsibly center />
        </form>
      </Shell>
    );
  }

  // 2) the SMS code
  if (step === "code" && sent) {
    return (
      <Shell onClose={close}>
        <button type="button" onClick={() => { setStep("phone"); setError(null); }} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 4, height: 36, padding: 0, border: "none", background: "transparent", color: "var(--tc-muted)", fontSize: 14, fontWeight: 700 }}>
          <ChevronLeft size={16} />Change number
        </button>
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
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} style={{
                height: 58, borderRadius: 12, background: "var(--tc-page)", border: `2px solid ${error ? "#E5484D" : i === Math.min(code.length, 5) ? ACCENT : "var(--tc-outline)"}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontFamily: barlow, fontSize: 30, fontWeight: 700,
              }}>{code[i] ?? ""}</span>
            ))}
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

  // 3) your details (number already verified)
  if (step === "details") {
    return (
      <Shell onClose={close}>
        <form onSubmit={toDob} noValidate style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: "#2AB572" }}><CheckIcon size={14} />{sent?.display} verified</span>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Almost done</h1>
          </div>
          <FormField label="Name *" error={shown("firstName")}>
            <input autoComplete="given-name" value={f.firstName} onChange={(e) => set("firstName")(e.target.value)} onBlur={touch("firstName")} style={formInput(!!shown("firstName"))} />
          </FormField>
          <FormField label="Surname *" error={shown("lastName")}>
            <input autoComplete="family-name" value={f.lastName} onChange={(e) => set("lastName")(e.target.value)} onBlur={touch("lastName")} style={formInput(!!shown("lastName"))} />
          </FormField>
          <FormField label="Email *" error={shown("email")}>
            <input type="email" autoComplete="email" inputMode="email" value={f.email} onChange={(e) => set("email")(e.target.value)} onBlur={touch("email")} style={formInput(!!shown("email"))} />
          </FormField>
          <FormField label="Password *" error={shown("password")}>
            <span style={{ position: "relative", display: "block" }}>
              <input type={showPw ? "text" : "password"} autoComplete="new-password" value={f.password} onChange={(e) => set("password")(e.target.value)} onBlur={touch("password")} style={{ ...formInput(!!shown("password")), paddingRight: 56, ...(showPw ? {} : hiddenPw) }} />
              <button type="button" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw((v) => !v)} style={{ position: "absolute", right: 4, top: 4, width: 44, height: 44, border: "none", background: "transparent", color: "var(--tc-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {showPw ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </span>
          </FormField>
          <div style={{ borderRadius: 10, background: "var(--tc-panel)", border: `1.5px solid ${shown("over18") ? "#E5484D" : "transparent"}`, overflow: "hidden" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px", background: "var(--tc-raise)", cursor: "pointer" }}>
              <input type="checkbox" checked={f.over18} onChange={(e) => { set("over18")(e.target.checked); touch("over18")(); }} style={{ width: 24, height: 24, margin: 0, flexShrink: 0, accentColor: ACCENT }} />
              <span style={{ fontSize: 17 }}>I am over 18 years old *</span>
            </label>
            <p style={{ margin: 0, padding: "10px 16px 12px", fontSize: 13, lineHeight: 1.5, color: "var(--tc-muted)" }}>
              By creating an account you agree to accept our <a href="#" onClick={(e) => e.preventDefault()}>Terms and Conditions</a>, are over 18 and are aware of our Responsible Gambling Policy.
            </p>
          </div>

          {errorLine(error)}
          <button type="submit" style={primaryBtn(valid)}>CONTINUE</button>
        </form>
      </Shell>
    );
  }

  // 4) date of birth
  if (step === "dob") {
    const thisYear = new Date().getFullYear();
    const select = (label: string, value: string, set: (v: string) => void, options: [string, string][]) => (
      <label style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 14, color: "var(--tc-muted)" }}>{label}</span>
        <select value={value} onChange={(e) => { set(e.target.value); setError(null); }} style={{ ...formInput(!!dobProblem), padding: "0 12px", appearance: "auto" }}>
          <option value="">{label}</option>
          {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </label>
    );
    return (
      <Shell onClose={close}>
        <button type="button" onClick={() => { setStep("details"); setError(null); }} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 4, height: 36, padding: 0, border: "none", background: "transparent", color: "var(--tc-muted)", fontSize: 14, fontWeight: 700 }}>
          <ChevronLeft size={16} />Back
        </button>
        <form onSubmit={create} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Date of birth</h1>
            <p style={{ margin: 0, fontSize: 15, color: "var(--tc-muted)" }}>You must be 18 or older to bet on Poccabet.</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {select("Day", dob.day, (v) => setDob((x) => ({ ...x, day: v })), Array.from({ length: 31 }, (_, i) => [String(i + 1), String(i + 1)]))}
            {select("Month", dob.month, (v) => setDob((x) => ({ ...x, month: v })),
              ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => [String(i + 1), m]))}
            {select("Year", dob.year, (v) => setDob((x) => ({ ...x, year: v })), Array.from({ length: 83 }, (_, i) => String(thisYear - 18 - i)).map((y) => [y, y]))}
          </div>
          {dobProblem && <p role="alert" style={{ margin: 0, fontSize: 13, color: "#E5484D" }}>{dobProblem}</p>}
          {errorLine(error)}
          <button type="submit" disabled={busy} style={primaryBtn(!!dobIso && !dobProblem && !busy)}>{busy ? "CREATING ACCOUNT…" : "CREATE ACCOUNT"}</button>
        </form>
      </Shell>
    );
  }

  // 5) Congratulations
  return (
    <Shell onClose={() => navigate("/", { replace: true })}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "12px 0", textAlign: "center" }}>
        <span aria-hidden="true" style={{ width: 84, height: 84, borderRadius: 42, background: "rgba(42, 181, 114, 0.14)", border: "2px solid #2AB572", color: "#2AB572", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckIcon size={44} />
        </span>
        <h1 style={{ margin: 0, fontFamily: barlow, fontStyle: "italic", fontSize: 40, fontWeight: 700, lineHeight: 1 }}>CONGRATULATIONS!</h1>
        <p style={{ margin: 0, fontSize: 17 }}>Welcome to Poccabet, <strong>{f.firstName.trim()}</strong>.</p>
        <p style={{ margin: 0, fontSize: 15, color: "var(--tc-muted)" }}>Your account is ready and your number {sent?.display} is verified.</p>
        {demo && (
          <p style={{ margin: 0, padding: "12px 16px", borderRadius: 12, background: "var(--tc-page)", fontSize: 14, color: "var(--tc-soft)" }}>
            We've added <strong style={{ color: ACCENT }}>{`₦${balance.toLocaleString("en-US")}`}</strong> in demo funds so you can start betting.
          </p>
        )}
      </div>
      <button type="button" onClick={() => navigate("/", { replace: true })} style={primaryBtn(true)}>START BETTING</button>
      <PlayResponsibly center />
    </Shell>
  );
}

// ---------- log in ----------
// The welcome at the top of log-in: a big headline and how many games are live right now.
function LoginHero() {
  const [live, setLive] = useState<number | null>(null);
  useEffect(() => { api.getLiveFixtures().then((r) => setLive(r.count)).catch(() => {}); }, []);
  return (
    <div style={{ marginTop: 88, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <h2 style={{ margin: 0, fontFamily: barlow, fontStyle: "italic", fontWeight: 700, fontSize: 46, lineHeight: 0.95, letterSpacing: 0.5, textShadow: "0 2px 12px rgba(0, 0, 0, 0.6)" }}>
        WELCOME <span style={{ color: ACCENT }}>BACK</span>
      </h2>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#F2F4F6", textShadow: "0 1px 8px rgba(0, 0, 0, 0.7)" }}>Your next big win is one tap away</p>
      {!!live && (
        <span style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: "rgba(8, 12, 15, 0.6)", border: "1px solid rgba(229, 72, 77, 0.5)", fontSize: 13, fontWeight: 800 }}>
          <span aria-hidden="true" className="tc-live-pulse" />
          {live} game{live === 1 ? "" : "s"} live now
        </span>
      )}
    </div>
  );
}
export function RedesignLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [useEmail, setUseEmail] = useState(false);
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
    <Shell onClose={close} image="/slides/Slide-1-m.jpg" banner={<LoginHero />}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Log in</h1>
        {/* Log in with either: the phone number or the email on the account. */}
        <div role="tablist" aria-label="Log in with" style={{ display: "flex", padding: 4, borderRadius: 12, background: "var(--tc-page)" }}>
          {([["phone", "Phone number"], ["email", "Email"]] as const).map(([id, label]) => {
            const on = (id === "email") === useEmail;
            return (
              <button key={id} type="button" role="tab" aria-selected={on} onClick={() => { setUseEmail(id === "email"); setError(null); }} style={{
                flex: 1, height: 40, borderRadius: 9, border: "none", background: on ? "var(--tc-raise)" : "transparent",
                color: on ? "var(--tc-text)" : "var(--tc-muted)", fontSize: 14, fontWeight: on ? 800 : 700,
              }}>{label}</button>
            );
          })}
        </div>
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
      </form>
    </Shell>
  );
}
