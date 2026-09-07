import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { fetchHostProfile, supabase, type HostProfile } from '../lib/supabase';

type AuthState = {
  /** null while the stored session is still being read. */
  hostId: string | null | undefined;
  profile: HostProfile | null;
  refreshProfile: () => Promise<void>;
};

const Context = createContext<AuthState>({ hostId: undefined, profile: null, refreshProfile: async () => {} });

export function AuthProvider({ children }: PropsWithChildren) {
  const [hostId, setHostId] = useState<string | null | undefined>(undefined);
  const [profile, setProfile] = useState<HostProfile | null>(null);

  const refreshProfile = useMemo(
    () => async () => {
      try {
        setProfile(await fetchHostProfile());
      } catch {
        setProfile(null);
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHostId(data.session?.user.id ?? null);
    });

    // Fires on sign-in, sign-out and token refresh, keeping every screen in sync.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setHostId(session?.user.id ?? null);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (hostId) refreshProfile();
    else setProfile(null);
  }, [hostId, refreshProfile]);

  const value = useMemo(() => ({ hostId, profile, refreshProfile }), [hostId, profile, refreshProfile]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useAuth = () => useContext(Context);
