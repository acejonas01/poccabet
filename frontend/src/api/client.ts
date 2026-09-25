const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

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
    throw new ApiError(message, res.status, body.code, body.details);
  }

  return res.json();
}

export const api = {
  signup: (data: { email: string; password: string; displayName: string }) =>
    request<{ token: string; user: any; wallet: { balance: number; demo?: boolean } }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: any; wallet: { balance: number; demo?: boolean } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getWallet: () => request<{ balance: number; demo?: boolean }>("/api/wallet"),
  demoTopUp: () => request<{ balance: number }>("/api/wallet/demo-topup", { method: "POST" }),
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
