/**
 * Typed contracts for all AI route responses.
 *
 * Shared between server (route handlers) and client (hooks/components).
 * Zero runtime cost — pure types.
 */

export type CategorizeResponse = {
  category: string;
};

export type InsightType = "pattern" | "suggestion" | "warning" | "observation";

export type Insight = {
  type: InsightType;
  title: string;
  description: string;
};

export type InsightsResponse = {
  insights: Insight[];
  topCategory: string;
  totalSpent: number;
  avgMonthlySpend: number;
};

export type MonthlySummaryResponse = {
  narrative: string;
  period: string;
  highlights: string[];
};

/** Standard error shape for all AI routes. */
export type AIErrorResponse = {
  error: string;
};
