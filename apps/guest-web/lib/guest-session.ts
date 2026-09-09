const STORAGE_KEY = "splitup.session";
/**
 * The app shipped as AddaSplit, then SplitPay, then SplitSave. A guest who
 * claimed items under either name would otherwise come back as a stranger and
 * lose them, so adopt an older id when no current one exists. Newest first.
 */
const LEGACY_STORAGE_KEYS = ["splitsave.session", "splitpay.session", "addasplit.session"];

/**
 * A RFC 4122 v4 UUID, without assuming a secure context.
 *
 * `crypto.randomUUID` exists only on HTTPS and localhost, so it is undefined
 * for any guest who opens the bill over plain HTTP on a LAN address — which is
 * exactly how the QR is tested from a phone. `crypto.getRandomValues` has no
 * such restriction, so prefer it before falling back to Math.random.
 */
function createUUID(): string {
  const webCrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (typeof webCrypto?.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof webCrypto?.getRandomValues === "function") {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }

  // Set the version (4) and variant (10xx) bits.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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

    for (const previous of LEGACY_STORAGE_KEYS) {
      const legacy = window.localStorage.getItem(`${previous}.${token}`);
      if (legacy) {
        window.localStorage.setItem(key, legacy);
        return legacy;
      }
    }

    const created = createUUID();
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    // Private mode or blocked storage: fall back to a per-tab identity.
    return createUUID();
  }
}
