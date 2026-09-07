const STORAGE_KEY = "addasplit.session";

/**
 * A stable per-browser UUID. This is the guest's only identity — the RPCs pair
 * it with the split's public token, so no account or login is ever needed.
 * Scoped per split so two tabs on different bills stay independent.
 */
export function getSessionId(token: string): string {
  const key = `${STORAGE_KEY}.${token}`;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    // Private mode or blocked storage: fall back to a per-tab identity.
    return crypto.randomUUID();
  }
}
