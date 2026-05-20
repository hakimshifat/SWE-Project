import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { PublicUser } from "../../shared/src/types";
import { api } from "./api";

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  setUser: (user: PublicUser | null) => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const result = await api.me();
    setUser(result.user);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const value = useMemo(() => ({ user, loading, setUser, refresh }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
