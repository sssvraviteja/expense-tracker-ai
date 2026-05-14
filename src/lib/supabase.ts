import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to .env.local and restart the dev server.",
  );
} else if (process.env.NODE_ENV === "development") {
  try {
    const host = new URL(supabaseUrl).host;
    console.info("[supabase] configured", { host, anonKeyLength: supabaseAnonKey.length });
  } catch {
    console.error("[supabase] NEXT_PUBLIC_SUPABASE_URL is not a valid URL:", supabaseUrl.slice(0, 64));
  }
}

/**
 * Single shared Supabase client for the entire app.
 *
 * auth.persistSession = true (default) means Supabase stores the JWT in
 * localStorage and refreshes it automatically — no extra cookie logic needed
 * for a pure client-side auth flow.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
