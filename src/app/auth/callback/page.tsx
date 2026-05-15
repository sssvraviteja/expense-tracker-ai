"use client";

/**
 * /auth/callback — landing page for Supabase email confirmation links.
 *
 * WHAT HAPPENS HERE:
 * When a user clicks the confirmation link in their email, Supabase redirects
 * them to this URL in one of two formats:
 *
 *   Implicit flow:  /auth/callback#access_token=...&refresh_token=...&type=signup
 *   PKCE flow:      /auth/callback?code=...
 *
 * For the implicit flow, supabase-js detects the hash fragment automatically
 * (detectSessionInUrl: true) and fires onAuthStateChange with SIGNED_IN.
 * Our AuthProvider picks that up and sets the user — so we just wait and redirect.
 *
 * For the PKCE flow (newer Supabase projects), we read the `code` query param
 * and call exchangeCodeForSession() manually to complete the handshake.
 *
 * WHY NOT just use the root page (/)?
 * The root page redirects immediately based on auth state. If the token
 * hasn't been processed yet when it renders, it sees no user and redirects
 * to /auth/login — losing the session tokens in the URL.
 * A dedicated callback page waits for the exchange to complete first.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      // PKCE flow: Supabase puts a `code` param in the query string
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setError(error.message);
          return;
        }
      }

      // Implicit flow: supabase-js has already detected the #access_token
      // fragment via detectSessionInUrl and fired onAuthStateChange.
      // Either way, the session is now established — go to dashboard.
      router.replace("/dashboard");
    }

    void handleCallback();
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Confirmation failed: {error}
        </p>
        <a href="/auth/login" className="text-sm underline underline-offset-4">
          Back to login
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Confirming your account…</p>
    </div>
  );
}
