import { GoogleGenerativeAI } from "@google/generative-ai";

export const AI_MODELS = {
  fast: "gemini-2.0-flash",
  powerful: "gemini-2.0-flash",
} as const;

export function getGenAI(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new MissingApiKeyError();
  }
  return new GoogleGenerativeAI(key);
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not set in environment variables");
    this.name = "MissingApiKeyError";
  }
}
