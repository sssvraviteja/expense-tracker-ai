/**
 * POST /api/ai/monthly-summary
 *
 * NARRATIVE GENERATION (teach):
 * ──────────────────────────────
 * This endpoint generates a human-readable financial narrative — the kind
 * a smart friend who's also a CFO would give you at end of month.
 *
 * The key difference vs. /insights:
 * - /insights → structured JSON, card-based UI, scannable
 * - /monthly-summary → natural language prose, story-like, emotional resonance
 *
 * Both patterns are valuable in AI-native products. Use structured JSON when
 * users need to scan/act on data. Use narrative when you want users to
 * understand and feel the story behind their numbers.
 *
 * MULTI-MONTH COMPARISON (teach):
 * ──────────────────────────────────
 * We pass both the current month and previous month data. Claude can then
 * make concrete comparisons ("you spent 24% more on food this month").
 * This is much more valuable than single-period analysis.
 *
 * FUTURE AGENTIC EVOLUTION (teach):
 * ────────────────────────────────────
 * Right now: user triggers → single AI call → static result.
 *
 * In a more agentic architecture, this could become:
 * 1. Agent detects it's month-end → automatically triggers summary
 * 2. Agent compares to user's stated budget goals (stored in memory)
 * 3. Agent sends a push notification with the narrative
 * 4. If overspending detected → agent pro-actively suggests corrections
 *
 * The route handler you write today becomes a "tool" in that future agent.
 * Write it with that in mind: clean inputs, clean outputs, no side effects.
 */

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic, AI_MODELS } from "@/lib/ai";
import type { MonthlySummaryResponse, AIErrorResponse } from "@/types/ai";

type ExpenseInput = {
  amount: number;
  description: string;
  category: string;
  date: string;
};

function getMonthLabel(yyyy_mm: string): string {
  const [year, month] = yyyy_mm.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("en-IN", { month: "long", year: "numeric" });
}

function filterByMonth(expenses: ExpenseInput[], yyyyMm: string): ExpenseInput[] {
  return expenses.filter((e) => e.date.startsWith(yyyyMm));
}

function summarizeMonth(expenses: ExpenseInput[]) {
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    total += e.amount;
  }
  return { byCategory, total: Math.round(total * 100) / 100, count: expenses.length };
}

const SYSTEM_PROMPT = `You are a friendly personal finance coach writing a brief monthly expense summary for an Indian user.

Return ONLY this JSON structure (no markdown, no explanation):
{
  "narrative": "2-3 sentence conversational summary of the month's spending. Use ₹ for amounts. Be specific with numbers. Include one comparison to previous month if data is available.",
  "period": "Month Year (e.g., January 2025)",
  "highlights": [
    "Specific highlight 1 — use actual numbers",
    "Specific highlight 2 — use actual numbers",
    "Specific highlight 3 — use actual numbers"
  ]
}

Tone: friendly, direct, specific. Like a smart friend reviewing your finances — not a bank bot.
Examples of good narrative: "You spent ₹12,450 in December, up 18% from November. Food was your biggest category at ₹4,200 — mostly weekend dining. A solid month overall, with travel spending down significantly."
Do NOT: give generic advice, repeat the same point twice, use vague language.`;

export async function POST(req: NextRequest) {
  // ── 1. Input validation ────────────────────────────────────────────────────
  let expenses: ExpenseInput[];
  let targetMonth: string | undefined;

  try {
    const body = await req.json();
    if (!Array.isArray(body?.expenses)) {
      return Response.json({ error: "expenses array is required" } satisfies AIErrorResponse, { status: 400 });
    }
    expenses = body.expenses as ExpenseInput[];
    targetMonth = typeof body.month === "string" ? body.month : undefined;
  } catch {
    return Response.json({ error: "Invalid JSON body" } satisfies AIErrorResponse, { status: 400 });
  }

  if (expenses.length === 0) {
    return Response.json({
      narrative: "No expenses recorded yet. Start adding expenses to see your monthly summary.",
      period: targetMonth ? getMonthLabel(targetMonth) : "This month",
      highlights: [],
    } satisfies MonthlySummaryResponse);
  }

  // ── 2. Determine target month (default: most recent) ──────────────────────
  const allMonths = [...new Set(expenses.map((e) => e.date.slice(0, 7)))].sort();
  const currentMonth = targetMonth ?? allMonths[allMonths.length - 1] ?? "";
  const prevMonthIdx = allMonths.indexOf(currentMonth) - 1;
  const prevMonth = prevMonthIdx >= 0 ? allMonths[prevMonthIdx] : null;

  // ── 3. Build compact prompt payload ───────────────────────────────────────
  const currentData = summarizeMonth(filterByMonth(expenses, currentMonth));
  const prevData = prevMonth ? summarizeMonth(filterByMonth(expenses, prevMonth)) : null;

  const dataForAI: Record<string, unknown> = {
    currentMonth: {
      period: getMonthLabel(currentMonth),
      totalSpent: currentData.total,
      expenseCount: currentData.count,
      byCategory: currentData.byCategory,
    },
  };

  if (prevData && prevMonth) {
    dataForAI.previousMonth = {
      period: getMonthLabel(prevMonth),
      totalSpent: prevData.total,
      byCategory: prevData.byCategory,
    };
    // Pre-compute % change to reduce reasoning load
    const change = prevData.total > 0
      ? Math.round(((currentData.total - prevData.total) / prevData.total) * 100)
      : null;
    if (change !== null) dataForAI.monthOverMonthChange = `${change > 0 ? "+" : ""}${change}%`;
  }

  // ── 4. Claude API call ─────────────────────────────────────────────────────
  try {
    const response = await anthropic.messages.create({
      model: AI_MODELS.powerful, // claude-opus-4-7: narrative quality matters here
      max_tokens: 1024,
      thinking: { type: "adaptive" },
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ] as Anthropic.TextBlockParam[],
      messages: [
        {
          role: "user",
          content: `Write a monthly summary for this data:\n\n${JSON.stringify(dataForAI, null, 2)}`,
        },
      ],
    });

    // ── 5. Parse response ────────────────────────────────────────────────────
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text block in response");
    }

    let parsed: Partial<MonthlySummaryResponse>;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      throw new Error(`Model returned non-JSON: ${textBlock.text.slice(0, 200)}`);
    }

    return Response.json({
      narrative: typeof parsed.narrative === "string" ? parsed.narrative : "Unable to generate summary.",
      period: typeof parsed.period === "string" ? parsed.period : getMonthLabel(currentMonth),
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.filter((h): h is string => typeof h === "string")
        : [],
    } satisfies MonthlySummaryResponse);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      console.error("[monthly-summary] Rate limited:", err.message);
      return Response.json({ error: "AI service busy, please try again" } satisfies AIErrorResponse, { status: 429 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("[monthly-summary] Auth error — check ANTHROPIC_API_KEY");
      return Response.json({ error: "AI service misconfigured" } satisfies AIErrorResponse, { status: 500 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("[monthly-summary] API error:", err.status, err.message);
      return Response.json({ error: "AI service error" } satisfies AIErrorResponse, { status: 500 });
    }

    console.error("[monthly-summary] Unexpected error:", err);
    return Response.json({ error: "Failed to generate summary" } satisfies AIErrorResponse, { status: 500 });
  }
}
