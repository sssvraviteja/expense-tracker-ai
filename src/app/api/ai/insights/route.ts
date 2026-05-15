import { NextRequest } from "next/server";
import { GoogleGenerativeAIFetchError } from "@google/generative-ai";
import { genAI, AI_MODELS } from "@/lib/ai";
import type { Insight, InsightsResponse, AIErrorResponse } from "@/types/ai";

type ExpenseInput = {
  amount: number;
  description: string;
  category: string;
  date: string;
};

type AggregatedData = {
  totalSpent: number;
  byCategory: Record<string, number>;
  byMonth: Record<string, number>;
  topDescriptions: string[];
  expenseCount: number;
  avgPerExpense: number;
};

function aggregateExpenses(expenses: ExpenseInput[]): AggregatedData {
  const byCategory: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  const descriptionCounts: Record<string, number> = {};

  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    const month = e.date.slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + e.amount;
    descriptionCounts[e.description] = (descriptionCounts[e.description] ?? 0) + 1;
  }

  const totalSpent = Object.values(byCategory).reduce((a, b) => a + b, 0);

  const topDescriptions = Object.entries(descriptionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([desc]) => desc);

  return {
    totalSpent: Math.round(totalSpent * 100) / 100,
    byCategory,
    byMonth,
    topDescriptions,
    expenseCount: expenses.length,
    avgPerExpense: expenses.length > 0 ? Math.round((totalSpent / expenses.length) * 100) / 100 : 0,
  };
}

const SYSTEM_PROMPT = `You are a personal finance analyst AI. Analyze expense data and return structured JSON insights.

Always return ONLY this JSON structure (no markdown, no explanation):
{
  "insights": [
    {
      "type": "pattern|suggestion|warning|observation",
      "title": "Short title (5-7 words)",
      "description": "Specific, actionable observation (1-2 sentences). Use actual numbers from the data."
    }
  ],
  "topCategory": "highest spending category name",
  "totalSpent": 12345.67,
  "avgMonthlySpend": 4115.22
}

Guidelines:
- Generate 3-5 insights covering: spending patterns, budget suggestions, category analysis, monthly trends
- Be specific — use actual numbers and percentages from the data
- For suggestions: give concrete, actionable advice (not generic tips)
- For warnings: only flag genuine anomalies (50%+ spike, unusually high single category)
- For patterns: note real behavioral patterns visible in the data
- All amounts are in Indian Rupees (₹)`;

export async function POST(req: NextRequest) {
  let expenses: ExpenseInput[];
  try {
    const body = await req.json();
    if (!Array.isArray(body?.expenses)) {
      return Response.json({ error: "expenses array is required" } satisfies AIErrorResponse, { status: 400 });
    }
    expenses = body.expenses as ExpenseInput[];
  } catch {
    return Response.json({ error: "Invalid JSON body" } satisfies AIErrorResponse, { status: 400 });
  }

  if (expenses.length === 0) {
    return Response.json({
      insights: [],
      topCategory: "None",
      totalSpent: 0,
      avgMonthlySpend: 0,
    } satisfies InsightsResponse);
  }

  const agg = aggregateExpenses(expenses);
  const months = Object.keys(agg.byMonth).sort();
  const avgMonthlySpend = months.length > 0
    ? Math.round((agg.totalSpent / months.length) * 100) / 100
    : agg.totalSpent;

  const dataForAI = {
    totalSpent: agg.totalSpent,
    expenseCount: agg.expenseCount,
    avgPerExpense: agg.avgPerExpense,
    byCategory: agg.byCategory,
    monthlyTotals: agg.byMonth,
    frequentMerchants: agg.topDescriptions,
    period: months.length > 0 ? `${months[0]} to ${months[months.length - 1]}` : "unknown",
  };

  try {
    const model = genAI.getGenerativeModel({
      model: AI_MODELS.powerful,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 2048,
      },
    });

    const result = await model.generateContent(
      `Analyze this expense data and return insights:\n\n${JSON.stringify(dataForAI, null, 2)}`
    );
    const text = result.response.text();

    let parsed: Partial<InsightsResponse>;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Model returned non-JSON: ${text.slice(0, 200)}`);
    }

    const insights: Insight[] = Array.isArray(parsed.insights)
      ? parsed.insights.filter(
          (i): i is Insight =>
            typeof i === "object" &&
            i !== null &&
            typeof i.title === "string" &&
            typeof i.description === "string",
        )
      : [];

    const topCategory =
      typeof parsed.topCategory === "string"
        ? parsed.topCategory
        : Object.entries(agg.byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";

    return Response.json({
      insights,
      topCategory,
      totalSpent: agg.totalSpent,
      avgMonthlySpend,
    } satisfies InsightsResponse);
  } catch (err) {
    if (err instanceof GoogleGenerativeAIFetchError) {
      if (err.status === 429) {
        console.error("[insights] Rate limited:", err.message);
        return Response.json({ error: "AI service busy, please try again" } satisfies AIErrorResponse, { status: 429 });
      }
      if (err.status === 401 || err.status === 403) {
        console.error("[insights] Auth error — check GEMINI_API_KEY");
        return Response.json({ error: "AI service misconfigured" } satisfies AIErrorResponse, { status: 500 });
      }
      console.error("[insights] API error:", err.status, err.message);
      return Response.json({ error: "AI service error" } satisfies AIErrorResponse, { status: 500 });
    }
    console.error("[insights] Unexpected error:", err);
    return Response.json({ error: "Failed to generate insights" } satisfies AIErrorResponse, { status: 500 });
  }
}
