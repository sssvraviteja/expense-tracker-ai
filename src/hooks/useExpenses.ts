"use client";

/**
 * useExpenses — all expense data-fetching and mutations in one place.
 *
 * WHY A CUSTOM HOOK?
 * Pulling data logic out of the component means:
 * - The component only worries about rendering
 * - The data layer is testable in isolation
 * - We can swap Supabase for a different backend later without touching the UI
 *
 * HOW RLS MAKES THIS SECURE:
 * We don't pass user_id in queries — Supabase injects it automatically on the
 * server via auth.uid(). The RLS policies enforce that each user only ever
 * sees, inserts, updates, or deletes their own rows. The client just calls
 * the table normally; security is database-level, not frontend-level.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Expense, ExpenseRow } from "@/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function toPostgresDateOnly(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Expense date is empty");
  const isoPrefix = /^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/.exec(trimmed);
  if (isoPrefix) return isoPrefix[1];
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  const dt = new Date(trimmed);
  if (Number.isNaN(dt.getTime())) throw new Error(`Invalid date: "${raw}"`);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function rowToExpense(row: ExpenseRow): Expense {
  const rawDate = row.date != null ? String(row.date) : "";
  let date: string;
  try {
    date = toPostgresDateOnly(rawDate);
  } catch {
    date = rawDate.slice(0, 10);
  }
  return { id: row.id, amount: Number(row.amount), description: row.description, category: row.category, date };
}

// ─── types ───────────────────────────────────────────────────────────────────

export type AddExpenseInput = {
  amount: number;
  description: string;
  category: string;
  date: string;
};

export type UseExpensesReturn = {
  expenses: Expense[];
  loading: boolean;
  error: string | null;
  addExpense: (input: AddExpenseInput) => Promise<{ error: string | null }>;
  updateExpense: (id: string, input: AddExpenseInput) => Promise<{ error: string | null }>;
  deleteExpense: (id: string) => Promise<{ error: string | null }>;
  clearError: () => void;
};

// ─── hook ────────────────────────────────────────────────────────────────────

/**
 * Pass userId so the hook knows when a real user is available.
 * Passing null skips the load (unauthenticated or still loading).
 */
export function useExpenses(userId: string | null): UseExpensesReturn {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Avoid state updates on unmounted components
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // ── load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) {
      setExpenses([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from("expenses")
      .select("id, amount, description, category, date")
      .order("date", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
        } else {
          setExpenses((data ?? []).map(row => rowToExpense(row as ExpenseRow)));
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userId]);

  // ── add ───────────────────────────────────────────────────────────────────

  const addExpense = useCallback(async (input: AddExpenseInput) => {
    let dateIso: string;
    try {
      dateIso = toPostgresDateOnly(input.date);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid date";
      setError(msg);
      return { error: msg };
    }

    const payload = { amount: input.amount, description: input.description, category: input.category, date: dateIso };
    const { data, error } = await supabase
      .from("expenses")
      .insert(payload)
      .select("id, amount, description, category, date")
      .single();

    if (error) {
      const msg = [error.message, error.details, error.hint].filter(Boolean).join(" — ");
      setError(msg);
      return { error: msg };
    }
    if (!data) {
      const msg = "Saved, but no row returned. Check your RLS SELECT policy.";
      setError(msg);
      return { error: msg };
    }

    const newExpense = rowToExpense(data as ExpenseRow);
    setExpenses(prev => [newExpense, ...prev]);
    return { error: null };
  }, []);

  // ── update ────────────────────────────────────────────────────────────────

  const updateExpense = useCallback(async (id: string, input: AddExpenseInput) => {
    let dateIso: string;
    try {
      dateIso = toPostgresDateOnly(input.date);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid date";
      setError(msg);
      return { error: msg };
    }

    const payload = { amount: input.amount, description: input.description, category: input.category, date: dateIso };
    const { data, error } = await supabase
      .from("expenses")
      .update(payload)
      .eq("id", id)
      .select("id, amount, description, category, date")
      .single();

    if (error) {
      const msg = error.message;
      setError(msg);
      return { error: msg };
    }
    if (!data) {
      const msg = "Updated, but no row returned. Check your RLS SELECT policy.";
      setError(msg);
      return { error: msg };
    }

    const updated = rowToExpense(data as ExpenseRow);
    setExpenses(prev => prev.map(e => (e.id === id ? updated : e)));
    return { error: null };
  }, []);

  // ── delete ────────────────────────────────────────────────────────────────

  const deleteExpense = useCallback(async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return { error: error.message };
    }
    setExpenses(prev => prev.filter(e => e.id !== id));
    return { error: null };
  }, []);

  return { expenses, loading, error, addExpense, updateExpense, deleteExpense, clearError };
}
