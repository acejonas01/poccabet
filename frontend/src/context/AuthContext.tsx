import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { api } from "../api/client";

interface User {
  id: string;
  email: string;
  displayName: string;
}

interface AuthContextValue {
  user: User | null;
  balance: number;
  demo: boolean; // play-money wallet (simulation mode)
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  refreshBalance: () => Promise<void>;
  setBalance: (naira: number) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [balance, setBalance] = useState<number>(0);
  const [demo, setDemo] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    setUser(res.user);
    setBalance(res.wallet.balance);
    setDemo(!!res.wallet.demo);
  }, []);

  const signup = useCallback(async (email: string, password: string, displayName: string) => {
    const res = await api.signup({ email, password, displayName });
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(res.user));
    setUser(res.user);
    setBalance(res.wallet.balance);
    setDemo(!!res.wallet.demo);
  }, []);

  const logout = useCallback(() => {
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

  return (
    <AuthContext.Provider
      value={{ user, balance, demo, isAuthenticated: !!user, login, signup, logout, refreshBalance, setBalance }}
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
