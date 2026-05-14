"use client";

/**
 * Root page — /
 *
 * Acts as a smart entry point:
 * - Authenticated  → /dashboard
 * - Unauthenticated → /auth/login
 *
 * We wait for auth to resolve before redirecting so we never
 * flash the wrong page.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/dashboard" : "/auth/login");
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
