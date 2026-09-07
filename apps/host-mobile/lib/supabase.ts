import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True when the app has been pointed at a real Supabase instance. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Sessions persist so a host stays signed in between launches. AsyncStorage is
 * the React Native store; on web it is backed by localStorage, so the same
 * client works on both. detectSessionInUrl stays off because this app never
 * handles an OAuth redirect.
 */
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export type HostProfile = {
  id: string;
  displayName: string;
  bkashNumber: string | null;
  nagadNumber: string | null;
};

/** The signed-in host's id, or null when nobody is signed in. */
export async function currentHostId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Throws with a readable message rather than letting callers write to nothing. */
export async function requireHostId(): Promise<string> {
  const id = await currentHostId();
  if (!id) throw new Error('Sign in to continue');
  return id;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message);
}

export async function signUp(email: string, password: string, displayName: string): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: displayName.trim() } },
  });
  if (error) throw new Error(error.message);
  // Projects with email confirmation on return a user but no session.
  if (!data.session) {
    throw new Error('Check your email to confirm the account, then sign in.');
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function fetchHostProfile(): Promise<HostProfile | null> {
  const id = await currentHostId();
  if (!id) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, bkash_number, nagad_number')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    displayName: data.display_name ?? '',
    bkashNumber: data.bkash_number,
    nagadNumber: data.nagad_number,
  };
}

/** Payment numbers live on the profile, so every new split inherits them. */
export async function updateHostProfile(patch: Partial<Omit<HostProfile, 'id'>>): Promise<void> {
  const id = await requireHostId();
  const { error } = await supabase
    .from('profiles')
    .update({
      ...(patch.displayName !== undefined ? { display_name: patch.displayName.trim() } : {}),
      ...(patch.bkashNumber !== undefined ? { bkash_number: patch.bkashNumber?.trim() || null } : {}),
      ...(patch.nagadNumber !== undefined ? { nagad_number: patch.nagadNumber?.trim() || null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// Web reloads lose in-memory state; AsyncStorage keeps the session across them.
export const sessionStorageBackend = Platform.OS === 'web' ? 'localStorage' : 'AsyncStorage';
