"use client";

/**
 * Login page — /auth/login
 *
 * FLOW:
 * 1. User submits email + password
 * 2. We call signIn() from AuthProvider (which calls supabase.auth.signInWithPassword)
 * 3. Supabase returns a session → onAuthStateChange fires → AuthProvider updates user state
 * 4. We redirect to /dashboard
 *
 * The redirect happens in the useEffect that watches `user`. Once AuthProvider
 * confirms the user is logged in, we navigate away. This prevents a flash of
 * the login form after a successful login while the redirect is processing.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/AuthProvider";

export default function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already authenticated → skip login page
  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error } = await signIn(email.trim(), password);
    if (error) {
      setError(error);
      setSubmitting(false);
    }
    // On success: onAuthStateChange fires → user state updates → useEffect above redirects
  }

  // Show nothing while we check the existing session
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your expense tracker</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input id="email" type="email" autoComplete="email" required
                placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} className="h-10" />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Input id="password" type="password" autoComplete="current-password" required
                placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)} className="h-10" />
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full h-10" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="mr-2 size-4 animate-spin" aria-hidden />Signing in…</>
              ) : "Sign in"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/auth/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
