import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "[ai] Missing GEMINI_API_KEY. Add it to .env.local and restart.",
  );
}

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export const AI_MODELS = {
  fast: "gemini-2.0-flash",
  powerful: "gemini-2.0-flash",
} as const;
