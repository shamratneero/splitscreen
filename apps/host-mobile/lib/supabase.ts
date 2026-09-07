import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True when the app has been pointed at a real Supabase instance. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Session lives in memory only: the prototype signs the demo host in on demand
 * rather than depending on AsyncStorage, so this works on web and native alike.
 * Replace ensureHostSession with real sign-in when accounts land.
 */
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const demoEmail = process.env.EXPO_PUBLIC_DEMO_HOST_EMAIL ?? 'demo@addasplit.test';
const demoPassword = process.env.EXPO_PUBLIC_DEMO_HOST_PASSWORD ?? 'demo-password-123';

let signInPromise: Promise<string> | null = null;

/** Signs the demo host in once and reuses that session for later publishes. */
export async function ensureHostSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id) return data.session.user.id;

  signInPromise ??= supabase.auth
    .signInWithPassword({ email: demoEmail, password: demoPassword })
    .then(({ data: signedIn, error }) => {
      if (error) throw new Error(`Host sign-in failed: ${error.message}`);
      if (!signedIn.user) throw new Error('Host sign-in returned no user');
      return signedIn.user.id;
    })
    .catch((cause) => {
      signInPromise = null;
      throw cause;
    });

  return signInPromise;
}
