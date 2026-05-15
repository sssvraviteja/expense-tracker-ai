"use client";

/**
 * Dashboard — /dashboard  (protected route)
 *
 * HOW PROTECTION WORKS (client-side pattern):
 * 1. useAuth() gives us { user, loading } from AuthProvider
 * 2. While loading=true we render a spinner (session check in flight)
 * 3. Once loading=false:
 *    - user is null → redirect to /auth/login
 *    - user exists  → render the full dashboard
 *
 * WHY NOT use proxy.ts for this?
 * The client-side guard is simpler and good enough for most apps. The tradeoff:
 * an unauthenticated user briefly sees the spinner before being redirected.
 * If you need SSR-level protection (no flash at all, protected in CDN cache),
 * add @supabase/ssr and a proxy.ts. That's the next step after this lesson.
 *
 * useExpenses(user.id) loads expenses only when a real user exists, so there
 * is no risk of fetching data as an unauthenticated user.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { SummaryCards } from "@/components/expenses/SummaryCards";
import { ExpenseCharts } from "@/components/expenses/ExpenseCharts";
import { AddExpenseForm } from "@/components/expenses/AddExpenseForm";
import { ExpenseList } from "@/components/expenses/ExpenseList";
import { EditExpenseModal } from "@/components/expenses/EditExpenseModal";
import { useAuth } from "@/providers/AuthProvider";
import { useExpenses } from "@/hooks/useExpenses";
import { AIInsightsPanel } from "@/components/expenses/AIInsightsPanel";
import type { Expense } from "@/types";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Redirect unauthenticated users
  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [user, authLoading, router]);

  const { expenses, loading: expensesLoading, error, addExpense, updateExpense, deleteExpense, clearError } =
    useExpenses(user?.id ?? null);

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteExpense(id);
    setDeletingId(null);
  }

  // Loading screen while auth resolves
  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 border-b border-border pb-8">
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            AI Expense Tracker
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Log spending, spot patterns, and stay on budget.
          </p>
        </header>

        {error && (
          <p className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert" onClick={clearError}>
            {error}
          </p>
        )}

        <SummaryCards expenses={expenses} />
        <ExpenseCharts expenses={expenses} />

        {/* AI Analysis section — auto-loads when expenses are available */}
        <section className="mb-8">
          <AIInsightsPanel expenses={expenses} />
        </section>

        <div className="grid gap-8 lg:grid-cols-5 lg:items-start">
          <div className="lg:col-span-2">
            <AddExpenseForm onAdd={addExpense} disabled={expensesLoading} />
          </div>
          <div className="lg:col-span-3">
            <ExpenseList
              expenses={expenses}
              loading={expensesLoading}
              deletingId={deletingId}
              onEdit={setEditingExpense}
              onDelete={id => void handleDelete(id)}
            />
          </div>
        </div>
      </main>

      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          onSave={updateExpense}
          onClose={() => setEditingExpense(null)}
        />
      )}
    </div>
  );
}
