const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function getToken() {
  return localStorage.getItem("token");
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
    throw new Error(body.error ? JSON.stringify(body.error) : `Request failed: ${res.status}`);
  }

  return res.json();
}

export const api = {
  signup: (data: { email: string; password: string; displayName: string }) =>
    request<{ token: string; user: any; wallet: { balance: number } }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: any; wallet: { balance: number } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getWallet: () => request<{ balance: number }>("/api/wallet"),
  getEvents: () => request<{ events: any[] }>("/api/events"),
  getLiveOdds: (sport?: string) =>
    request<{ events: any[]; provider: string; count: number }>(
      `/api/odds/live${sport ? `?sport=${sport}` : ""}`
    ),
  syncOdds: (sport?: string) =>
    request<{ synced: number; total: number }>(
      `/api/odds/sync${sport ? `?sport=${sport}` : ""}`,
      { method: "POST" }
    ),
  getMyBets: () => request<{ bets: any[] }>("/api/bets"),
  placeBet: (data: { stake: number; outcomeIds: string[] }) =>
    request<{ bet: any }>("/api/bets", { method: "POST", body: JSON.stringify(data) }),
};
