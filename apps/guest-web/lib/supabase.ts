import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when the project has been pointed at a real Supabase instance. */
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured && process.env.NODE_ENV !== "production") {
  console.warn(
    "[splitsave] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are unset — the guest flow will show a setup notice.",
  );
}

/**
 * Guests are always anonymous: every read and write goes through a
 * security-definer RPC scoped by public_token + session_id, so the anon key
 * never needs a session of its own.
 */
export const supabase = createClient(url ?? "http://localhost", anonKey ?? "anon", {
  auth: { persistSession: false, autoRefreshToken: false },
});
