import { NextRequest } from "next/server";
import { GoogleGenerativeAIFetchError } from "@google/generative-ai";
import { genAI, AI_MODELS } from "@/lib/ai";
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
Do NOT: give generic advice, repeat the same point twice, use vague language.`;

export async function POST(req: NextRequest) {
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

  const allMonths = [...new Set(expenses.map((e) => e.date.slice(0, 7)))].sort();
  const currentMonth = targetMonth ?? allMonths[allMonths.length - 1] ?? "";
  const prevMonthIdx = allMonths.indexOf(currentMonth) - 1;
  const prevMonth = prevMonthIdx >= 0 ? allMonths[prevMonthIdx] : null;

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
    const change = prevData.total > 0
      ? Math.round(((currentData.total - prevData.total) / prevData.total) * 100)
      : null;
    if (change !== null) dataForAI.monthOverMonthChange = `${change > 0 ? "+" : ""}${change}%`;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: AI_MODELS.powerful,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 1024,
      },
    });

    const result = await model.generateContent(
      `Write a monthly summary for this data:\n\n${JSON.stringify(dataForAI, null, 2)}`
    );
    const text = result.response.text();

    let parsed: Partial<MonthlySummaryResponse>;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Model returned non-JSON: ${text.slice(0, 200)}`);
    }

    return Response.json({
      narrative: typeof parsed.narrative === "string" ? parsed.narrative : "Unable to generate summary.",
      period: typeof parsed.period === "string" ? parsed.period : getMonthLabel(currentMonth),
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.filter((h): h is string => typeof h === "string")
        : [],
    } satisfies MonthlySummaryResponse);
  } catch (err) {
    if (err instanceof GoogleGenerativeAIFetchError) {
      if (err.status === 429) {
        console.error("[monthly-summary] Rate limited:", err.message);
        return Response.json({ error: "AI service busy, please try again" } satisfies AIErrorResponse, { status: 429 });
      }
      if (err.status === 401 || err.status === 403) {
        console.error("[monthly-summary] Auth error:", err.status, err.message);
        return Response.json({ error: "AI service misconfigured" } satisfies AIErrorResponse, { status: 500 });
      }
      console.error("[monthly-summary] API error:", err.status, err.message);
      return Response.json({ error: "AI service error" } satisfies AIErrorResponse, { status: 500 });
    }
    console.error("[monthly-summary] Unexpected error:", String(err));
    return Response.json({ error: "Failed to generate summary" } satisfies AIErrorResponse, { status: 500 });
  }
}
