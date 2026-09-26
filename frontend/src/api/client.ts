const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// Where this visitor first came from (?utm_source= / ?ref= on the first visit, else the site that
// linked here). Kept on the device and sent with sign-up, for "which campaign brought players".
const SOURCE_KEY = "pocca-source";
function firstTouchSource(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const saved = localStorage.getItem(SOURCE_KEY);
    if (saved) return saved;
    const q = new URLSearchParams(window.location.search);
    let src = q.get("utm_source") || q.get("ref") || q.get("source") || "";
    if (!src && document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (host && host !== window.location.hostname) src = host;
    }
    if (!src) return undefined;
    localStorage.setItem(SOURCE_KEY, src.slice(0, 60));
    return src.slice(0, 60);
  } catch {
    return undefined;
  }
}
if (typeof window !== "undefined") firstTouchSource(); // remember it on the first page view

function getToken() {
  return localStorage.getItem("token");
}

// An API error keeps the server's machine-readable `code` and `details` next to the message.
export class ApiError extends Error {
  status: number;
  code?: string;
  details?: any;
  constructor(message: string, status: number, code?: string, details?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = typeof body.error === "string" ? body.error : body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`;
    // The account was suspended or closed while logged in: the app logs out and says why.
    if (token && (body.code === "ACCOUNT_SUSPENDED" || body.code === "ACCOUNT_DELETED" || body.code === "SESSION_EXPIRED")) {
      window.dispatchEvent(new CustomEvent("pocca:session-ended", { detail: { code: body.code, message } }));
    }
    throw new ApiError(message, res.status, body.code, body.details);
  }

  return res.json();
}

export const api = {
  signup: (data: { email: string; password: string; displayName: string }) =>
    request<{ token: string; user: any; wallet: { balance: number; demo?: boolean } }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ ...data, signupSource: firstTouchSource() }),
    }),
  // Phone sign-up: send a code → check it → create the account with the verification token.
  otpStart: (phone: string, email?: string) =>
    request<{ phone: string; display: string; resendIn: number; expiresIn: number; demoCode?: string }>("/api/auth/otp/start", {
      method: "POST", body: JSON.stringify({ phone, email, purpose: "signup" }),
    }),
  otpVerify: (phone: string, code: string) =>
    request<{ verificationToken: string }>("/api/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone, code }) }),
  // Forgotten password: code by SMS (or email for older accounts) → reset token → new password (logs in).
  resetStart: (to: { phone: string } | { email: string }) =>
    request<{ sentTo: string; resendIn: number; expiresIn: number; demoCode?: string }>("/api/auth/reset/start", { method: "POST", body: JSON.stringify(to) }),
  resetVerify: (to: { phone: string } | { email: string }, code: string) =>
    request<{ resetToken: string }>("/api/auth/reset/verify", { method: "POST", body: JSON.stringify({ ...to, code }) }),
  resetComplete: (resetToken: string, password: string) =>
    request<{ token: string; user: any; wallet: { balance: number; demo?: boolean } }>("/api/auth/reset/complete", { method: "POST", body: JSON.stringify({ resetToken, password }) }),
  signupPhone: (data: SignupDetails & { verificationToken: string }) =>
    request<{ token: string; user: any; wallet: { balance: number; demo?: boolean } }>("/api/auth/signup/phone", {
      method: "POST", body: JSON.stringify({ ...data, signupSource: firstTouchSource() }),
    }),
  login: (data: { email?: string; phone?: string; password: string }) =>
    request<{ token: string; user: any; wallet: { balance: number; demo?: boolean } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getWallet: () => request<{ balance: number; demo?: boolean }>("/api/wallet"),
  claimBonus: () => request<Profile>("/api/me/bonus", { method: "POST" }),
  getEvents: () => request<{ events: any[] }>("/api/events"),
  getLiveOdds: (sport?: string) =>
    request<{ events: any[]; provider: string; count: number }>(
      `/api/odds/live${sport ? `?sport=${sport}` : ""}`
    ),
  getLiveFixtures: () =>
    request<{ fixtures: any[]; count: number; fetchedAt: string; stale: boolean; simulated?: boolean }>("/api/live"),
  getUpcomingFixtures: () =>
    request<{ events: any[]; count: number; simulated?: boolean }>("/api/live/upcoming"),
  getResults: () =>
    request<{ results: any[]; count: number; fetchedAt: string; stale: boolean; simulated?: boolean }>("/api/live/results"),
  getWinners: () =>
    request<{ simulated: boolean; winners: { id: string; player: string; amount: number; stake?: number; product: string; detail?: string; at: string }[] }>("/api/live/winners"),
  recordPick: (pick: Record<string, unknown>) =>
    request<{ ok: boolean }>("/api/picks", { method: "POST", body: JSON.stringify(pick) }),
  getTopPick: () => request<{ top: any | null; totalToday: number }>("/api/picks/top"),
  syncOdds: (sport?: string) =>
    request<{ synced: number; total: number }>(
      `/api/odds/sync${sport ? `?sport=${sport}` : ""}`,
      { method: "POST" }
    ),
  // The logged-in user's account.
  getMe: () => request<Profile>("/api/me"),
  getTransactions: () =>
    request<{ transactions: { id: string; type: string; amount: number; balanceAfter: number | null; status: string; createdAt: string }[] }>("/api/wallet/transactions"),
  updateMe: (data: { firstName?: string; lastName?: string; email?: string }) =>
    request<Profile>("/api/me", { method: "PATCH", body: JSON.stringify(data) }),
  emailCodeStart: () => request<{ sentTo: string; resendIn: number; demoCode?: string }>("/api/me/email/start", { method: "POST" }),
  emailCodeVerify: (code: string) => request<Profile>("/api/me/email/verify", { method: "POST", body: JSON.stringify({ code }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean; token?: string }>("/api/me/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
  deleteAccount: (password: string) =>
    request<{ ok: boolean }>("/api/me", { method: "DELETE", body: JSON.stringify({ password, confirm: "DELETE" }) }),
  getMyBets: () => request<{ bets: Bet[] }>("/api/bets"),
  // Bet slip → bets. The server re-prices every selection; `odds` is what the user saw.
  placeBets: (data: {
    mode: "single" | "multiple"; stake: number; acceptOdds: "higher" | "any" | "none"; idempotencyKey: string;
    selections: { matchId: string; market: string; selection: string; odds: number }[];
  }) => request<{ bets: Bet[]; balance: number; repeated: boolean }>("/api/bets", { method: "POST", body: JSON.stringify(data) }),
  checkTicket: (ticket: string) => request<{ bet: Omit<Bet, "id" | "source"> }>(`/api/bets/ticket/${encodeURIComponent(ticket)}`),
  bookSlip: (selections: { matchId: string; market: string; selection: string }[]) =>
    request<{ code: string; count: number }>("/api/bets/book", { method: "POST", body: JSON.stringify({ selections }) }),
  loadSlip: (code: string) => request<{ code: string; available: BookedLeg[]; unavailable: unknown[] }>(`/api/bets/book/${encodeURIComponent(code)}`),
  // Old Theme D slip (database events).
  placeLegacyBet: (data: { stake: number; outcomeIds: string[] }) =>
    request<{ bet: Bet }>("/api/bets", { method: "POST", body: JSON.stringify(data) }),
};

export interface Profile {
  id: string; firstName: string | null; lastName: string | null; displayName: string;
  email: string | null; emailVerified: boolean; phone: string | null; phoneDisplay: string | null; phoneVerified: boolean;
  dateOfBirth: string | null; memberSince: string; balance: number; demo: boolean;
  bonus: { amount: number; claimed: boolean }; // welcome bonus: claimed once, needs a verified email
  stats: { bets: number; open: number; won: number; lost: number; staked: number; winnings: number };
}

export interface SignupDetails {
  firstName: string; lastName: string; email: string; password: string; ageConfirmed: true; dateOfBirth: string; referralCode?: string;
}

export interface BetSelectionInfo {
  matchId: string; home: string; away: string; league: string; country: string; kickoff: string | null;
  market: string; marketLabel: string; selection: string; odds: number; result: string;
}
export interface Bet {
  id: string; ticket: string; type: "SINGLE" | "ACCUMULATOR"; status: string; stake: number; totalOdds: number;
  potentialPayout: number; payout: number | null; source: string; createdAt: string; settledAt: string | null; selections: BetSelectionInfo[];
}
export interface BookedLeg {
  matchId: string; market: string; selection: string; marketLabel: string; odds: number; home: string; away: string; league: string; kickoff: string; live: boolean;
}
