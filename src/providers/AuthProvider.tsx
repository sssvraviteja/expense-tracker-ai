"use client";

/**
 * AuthProvider — the heart of client-side auth.
 *
 * HOW IT WORKS:
 * 1. On mount, call supabase.auth.getSession() to restore any persisted session
 *    from localStorage (Supabase stores the JWT there automatically).
 * 2. Subscribe to onAuthStateChange so we react to login, logout, and token
 *    refresh events fired by the Supabase JS client.
 * 3. Expose user, session, loading, and helper functions via React Context so
 *    any component in the tree can read auth state without prop drilling.
 *
 * WHY NOT proxy.ts / cookies?
 * For a pure client-side SPA-style auth flow, Supabase's localStorage strategy
 * is simpler and sufficient. The tradeoff: the first render on the server is
 * unauthenticated (SSR doesn't see the JWT). That's fine here — we do a
 * client-side redirect in protected pages, which is the beginner-friendly
 * pattern. You'd add @supabase/ssr + proxy.ts later for SSR-level protection.
 */

import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  /** true while the initial session check is still in flight */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Step 1: restore session from localStorage on first render
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Step 2: keep state in sync with Supabase auth events
    // SIGNED_IN fires on login and token refresh
    // SIGNED_OUT fires on logout or expired session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Use the current origin so the confirmation link works on localhost
        // AND on your deployed Vercel URL — no hardcoded URLs needed.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
