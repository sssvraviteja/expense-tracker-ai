"use client";

/**
 * useAI — client-side hooks for the three AI endpoints.
 *
 * DESIGN PRINCIPLE (teach):
 * ──────────────────────────
 * These hooks are pure HTTP clients. They know nothing about Claude or the
 * Anthropic API. They call YOUR server endpoints (/api/ai/*) and manage
 * loading/error state for the UI.
 *
 * This separation means:
 * - You can swap the AI provider without touching any component
 * - You can add auth headers, retry logic, or request deduplication here
 * - Components stay simple: they only see { data, loading, error }
 *
 * DEBOUNCE IN useCategorize (teach):
 * ──────────────────────────────────
 * Auto-categorization fires when the user pauses typing (500ms debounce).
 * Without debounce, every keystroke triggers an API call. With debounce,
 * you get one call after the user has typed a reasonable amount.
 * This is the standard pattern for AI-assisted input fields.
 */

import { useCallback, useRef, useState } from "react";
import type { Expense } from "@/types";
import type {
  CategorizeResponse,
  InsightsResponse,
  MonthlySummaryResponse,
} from "@/types/ai";

// ── useCategorize ─────────────────────────────────────────────────────────────

type UseCategorizeReturn = {
  categorize: (description: string) => Promise<string | null>;
  loading: boolean;
  error: string | null;
};

export function useCategorize(): UseCategorizeReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categorize = useCallback(async (description: string): Promise<string | null> => {
    if (!description.trim()) return null;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data: CategorizeResponse = await res.json();
      return data.category;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Categorization failed";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { categorize, loading, error };
}

// ── useInsights ───────────────────────────────────────────────────────────────

type UseInsightsReturn = {
  insights: InsightsResponse | null;
  loading: boolean;
  error: string | null;
  fetchInsights: (expenses: Expense[]) => Promise<void>;
};

export function useInsights(): UseInsightsReturn {
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Abort in-flight requests when a new one starts
  const abortRef = useRef<AbortController | null>(null);

  const fetchInsights = useCallback(async (expenses: Expense[]) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data: InsightsResponse = await res.json();
      setInsights(data);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Failed to load insights";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return { insights, loading, error, fetchInsights };
}

// ── useMonthlySummary ─────────────────────────────────────────────────────────

type UseMonthlySummaryReturn = {
  summary: MonthlySummaryResponse | null;
  loading: boolean;
  error: string | null;
  fetchSummary: (expenses: Expense[], month?: string) => Promise<void>;
};

export function useMonthlySummary(): UseMonthlySummaryReturn {
  const [summary, setSummary] = useState<MonthlySummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSummary = useCallback(async (expenses: Expense[], month?: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/monthly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses, month }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data: MonthlySummaryResponse = await res.json();
      setSummary(data);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Failed to load summary";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return { summary, loading, error, fetchSummary };
}
