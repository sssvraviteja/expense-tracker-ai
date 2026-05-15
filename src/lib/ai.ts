/**
 * ARCHITECTURE: Anthropic client lives here, server-side only.
 *
 * This module must NEVER be imported by client components ("use client").
 * Next.js Route Handlers (app/api/**) are the only callers.
 *
 * The ANTHROPIC_API_KEY environment variable is a server-side secret.
 * Next.js omits any env var not prefixed NEXT_PUBLIC_ from the browser
 * bundle, so this key never reaches the client even if someone accidentally
 * imports this file in a shared module.
 *
 * MODEL SELECTION STRATEGY (teach):
 * ─────────────────────────────────
 * Not all tasks need the most powerful model. Matching model to task is
 * one of the highest-leverage decisions in AI engineering:
 *
 *   claude-haiku-4-5   → Simple classification, single-field extraction.
 *                         ~10x cheaper than Opus, ~3x faster. Perfect for
 *                         categorize (30 input tokens → 5 output tokens).
 *
 *   claude-opus-4-7    → Complex reasoning, multi-dimensional analysis,
 *                         narrative generation. Use for insights/summaries
 *                         where quality matters more than latency/cost.
 *
 * TOKEN COST CONTEXT (teach):
 * ───────────────────────────
 * Haiku:  $1.00 input / $5.00 output per million tokens
 * Opus:   $5.00 input / $25.00 output per million tokens
 *
 * A categorize call costs ~0.000035¢ (Haiku).
 * An insights call costs ~0.002¢ (Opus, with caching).
 *
 * PROMPT CACHING (teach):
 * ───────────────────────
 * System prompts are stable across requests. Adding cache_control marks
 * the prefix as cacheable. On repeat requests, Anthropic serves the cached
 * prefix at ~10% of the input token cost. Breakeven is 2 requests for 5-min
 * TTL (1.25× write + 0.1× read < 2× uncached). Every production AI app
 * should use this for stable system prompts.
 */

import Anthropic from "@anthropic-ai/sdk";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "[ai] Missing ANTHROPIC_API_KEY. Add it to .env.local and restart.",
  );
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? "",
});

export const AI_MODELS = {
  /** Fast, cheap classification. ~$1/1M input tokens. */
  fast: "claude-haiku-4-5-20251001" as const,
  /** Most capable. Complex reasoning + narrative. ~$5/1M input tokens. */
  powerful: "claude-opus-4-7" as const,
} as const;
