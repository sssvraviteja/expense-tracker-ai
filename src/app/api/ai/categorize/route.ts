import { NextRequest } from "next/server";
import { GoogleGenerativeAIFetchError } from "@google/generative-ai";
import { getGenAI, MissingApiKeyError, AI_MODELS } from "@/lib/ai";
import { CATEGORY_OPTIONS } from "@/types";
import type { CategorizeResponse, AIErrorResponse } from "@/types/ai";

const SYSTEM_PROMPT = `You are an expense categorizer for an Indian expense tracker app.
Given a merchant name or expense description, return ONLY valid JSON with a single "category" field.

Valid categories: ${CATEGORY_OPTIONS.join(", ")}

Rules:
- Food restaurants/delivery/groceries → Food
- Fuel stations/petrol → Petrol
- Rent/housing/utilities → Rent
- PhonePe/GPay/NEFT/IMPS/bank transfers → UPI Payments
- E-commerce/retail/apparel → Shopping
- Cabs/trains/flights/bus → Travel
- Mobile/DTH/internet recharge → Recharge
- When unsure, pick the closest match — never return null

Examples:
{"description": "Swiggy"} → {"category": "Food"}
{"description": "Ola Cab"} → {"category": "Travel"}
{"description": "Jio Recharge"} → {"category": "Recharge"}

Return ONLY JSON. No explanation. No markdown.`;

export async function POST(req: NextRequest) {
  let description: string;
  try {
    const body = await req.json();
    description = typeof body?.description === "string" ? body.description.trim() : "";
  } catch {
    return Response.json({ error: "Invalid JSON body" } satisfies AIErrorResponse, { status: 400 });
  }

  if (!description) {
    return Response.json({ error: "description is required" } satisfies AIErrorResponse, { status: 400 });
  }

  try {
    const model = getGenAI().getGenerativeModel({
      model: AI_MODELS.fast,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 64,
      },
    });

    const result = await model.generateContent(JSON.stringify({ description }));
    const text = result.response.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Model returned non-JSON: ${text}`);
    }

    const category =
      typeof parsed === "object" &&
      parsed !== null &&
      "category" in parsed &&
      typeof (parsed as Record<string, unknown>).category === "string"
        ? (parsed as { category: string }).category
        : CATEGORY_OPTIONS[0];

    return Response.json({ category } satisfies CategorizeResponse);
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      console.error("[categorize] GEMINI_API_KEY not set — add it to Vercel environment variables");
      return Response.json({ error: "AI service not configured" } satisfies AIErrorResponse, { status: 503 });
    }
    if (err instanceof GoogleGenerativeAIFetchError) {
      if (err.status === 429) {
        console.error("[categorize] Rate limited:", err.message);
        return Response.json({ error: "AI service busy, please try again" } satisfies AIErrorResponse, { status: 429 });
      }
      if (err.status === 401 || err.status === 403) {
        console.error("[categorize] Auth error — GEMINI_API_KEY is invalid or expired");
        return Response.json({ error: "AI service misconfigured" } satisfies AIErrorResponse, { status: 503 });
      }
      console.error("[categorize] API error:", err.status, err.message);
      return Response.json({ error: "AI service error" } satisfies AIErrorResponse, { status: 500 });
    }
    console.error("[categorize] Unexpected error:", err);
    return Response.json({ error: "Failed to categorize" } satisfies AIErrorResponse, { status: 500 });
  }
}
