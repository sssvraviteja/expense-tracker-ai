import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[supabase client] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local and restart `next dev`.",
  );
} else if (process.env.NODE_ENV === "development") {
  try {
    const host = new URL(supabaseUrl).host;
    console.info("[supabase client] configured", {
      host,
      anonKeyLength: supabaseAnonKey.length,
    });
  } catch {
    console.error(
      "[supabase client] NEXT_PUBLIC_SUPABASE_URL is not a valid URL:",
      supabaseUrl.slice(0, 64),
    );
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
