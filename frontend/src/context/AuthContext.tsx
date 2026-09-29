import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { api, type SignupDetails } from "../api/client";
import { deferDeviceState, useDeviceState } from "../lib/browser";
import { forgetPlayer, identifyPlayer, track } from "../lib/analytics";

interface User {
  id: string;
  email: string | null;
  phone?: string | null;
  displayName: string;
}

interface AuthContextValue {
  user: User | null;
  balance: number;
  demo: boolean; // play-money wallet (simulation mode)
  isAuthenticated: boolean;
  // False until the saved login has been read from this device (on server-rendered pages that's
  // just after the first render). Pages that send logged-out visitors to /login wait for it.
  ready: boolean;
  login: (phoneOrEmail: string, password: string) => Promise<void>;
  signupWithPhone: (data: SignupDetails & { verificationToken: string }) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  resetPassword: (resetToken: string, password: string) => Promise<void>;
  refreshBalance: () => Promise<void>;
  setBalance: (naira: number) => void;
  updateUser: (changes: Partial<User>) => void;
  // Why the session ended on its own (account suspended or closed); shown once, then cleared.
  notice: SessionNotice | null;
  clearNotice: () => void;
}

export interface SessionNotice { code: string; message: string }

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useDeviceState<User | null>(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  }, null);
  const [ready, setReady] = useState(() => !deferDeviceState());
  useEffect(() => { setReady(true); }, []); // runs after useDeviceState has read the saved user
  const [balance, setBalance] = useState<number>(0);
  const [demo, setDemo] = useState(false);
  const [notice, setNotice] = useState<SessionNotice | null>(null);

  // A phone number, or an email for older accounts.
  const login = useCallback(async (phoneOrEmail: string, password: string) => {
    const id = phoneOrEmail.trim();
    const res = await api.login(id.includes("@") ? { email: id, password } : { phone: id, password });
    track("logged_in");
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    setUser(res.user);
    setBalance(res.wallet.balance);
    setDemo(!!res.wallet.demo);
  }, []);

  const resetPassword = useCallback(async (resetToken: string, password: string) => {
    const res = await api.resetComplete(resetToken, password);
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    setUser(res.user);
    setBalance(res.wallet.balance);
    setDemo(!!res.wallet.demo);
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName: string) => {
    const res = await api.signup({ email, password, displayName });
    track("signed_up", { method: "email" });
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    setUser(res.user);
    setBalance(res.wallet.balance);
    setDemo(!!res.wallet.demo);
  }, []);

  const signupWithPhone = useCallback(async (data: SignupDetails & { verificationToken: string }) => {
    const res = await api.signupPhone(data);
    track("signed_up", { method: "phone" });
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    setUser(res.user);
    setBalance(res.wallet.balance);
    setDemo(!!res.wallet.demo);
  }, []);

  // After editing the profile: keep the header name etc. in step.
  const updateUser = useCallback((changes: Partial<User>) => {
    setUser((u) => {
      if (!u) return u;
      const next = { ...u, ...changes };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    forgetPlayer();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setBalance(0);
    setDemo(false);
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!localStorage.getItem("token")) return;
    const res = await api.getWallet();
    setBalance(res.balance);
    setDemo(!!res.demo);
  }, []);

  useEffect(() => {
    if (user) refreshBalance().catch(() => {});
  }, [user, refreshBalance]);

  // Analytics: link this device's visits to the player (internal id only).
  useEffect(() => { if (user?.id) identifyPlayer(user.id); }, [user?.id]);

  // The server ended the session (suspended / closed account): log out and explain.
  useEffect(() => {
    const onEnded = (e: Event) => {
      const d = (e as CustomEvent<SessionNotice>).detail;
      logout();
      setNotice(d);
    };
    window.addEventListener("pocca:session-ended", onEnded);
    return () => window.removeEventListener("pocca:session-ended", onEnded);
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{ user, balance, demo, isAuthenticated: !!user, ready, login, signup, signupWithPhone, logout, resetPassword, refreshBalance, setBalance, updateUser, notice, clearNotice: () => setNotice(null) }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
