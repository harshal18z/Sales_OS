import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ session: null, user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let sub: { subscription: { unsubscribe: () => void } } | undefined;
    try {
      const res = supabase.auth.onAuthStateChange((_event, s) => {
        setSession(s);
        setLoading(false);
      });
      sub = res.data;
      supabase.auth.getSession().then(({ data }) => {
        setSession(data?.session ?? null);
        setLoading(false);
      }).catch((err) => {
        console.warn("[Auth] Failed to fetch session:", err);
        setLoading(false);
      });
    } catch (err) {
      console.warn("[Auth] Supabase initialization failed or missing credentials:", err);
      setLoading(false);
    }
    return () => sub?.subscription?.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
