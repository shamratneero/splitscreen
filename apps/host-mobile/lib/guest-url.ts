import { Platform } from 'react-native';

/**
 * The base URL a scanned QR should open.
 *
 * A phone can't resolve the host's `localhost`, so a QR encoding it is
 * unscannable in practice. When the configured value still points at localhost
 * but the host app is itself being served over the network (Expo web opened at
 * a LAN IP), borrow that hostname so the link works on the same WiFi without
 * any configuration.
 *
 * Set EXPO_PUBLIC_GUEST_URL to the deployed origin for anything beyond that.
 */
export function resolveGuestBaseURL(): string {
  const configured = (process.env.EXPO_PUBLIC_GUEST_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(configured);

  if (isLoopback && Platform.OS === 'web' && typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      const port = new URL(configured).port || '3000';
      return `${protocol}//${hostname}:${port}`;
    }
  }

  return configured;
}

/** True when the link would only resolve on the machine running the dev server. */
export function isLoopbackURL(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(url);
}
