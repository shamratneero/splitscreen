# Deploying AddaSplit

The QR code encodes whatever `EXPO_PUBLIC_GUEST_URL` points at. During local
development that is `localhost`, which **a phone cannot resolve** — the link
opens nothing. Fixing that is the whole of deployment for the guest app.

There are three stages, in increasing order of permanence.

## 1. Same WiFi (no deploy, works today)

Your Mac already serves the guest app on the local network. Point the host app
at that address instead of localhost:

```bash
# apps/host-mobile/.env.local
EXPO_PUBLIC_GUEST_URL=http://192.168.10.131:3000
```

Find the current address with `ipconfig getifaddr en0` — it changes when you
join a different network. Both phone and Mac must be on the same WiFi, and the
Next.js dev server must be running.

Good enough to test scanning with a real phone. Not shareable outside the room,
and it dies when your laptop sleeps.

## 2. Public URL for the guest app (Vercel)

The guest app is a normal Next.js app, so Vercel hosts it on the free tier.

1. Push this repo to GitHub (already done: `shamratneero/splitscreen`).
2. At [vercel.com/new](https://vercel.com/new), import the repository.
3. **Set Root Directory to `apps/guest-web`.** This is the only non-obvious
   step — without it Vercel builds the monorepo root and fails.
4. Add two Environment Variables, matching `apps/guest-web/.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy. You get something like `https://addasplit.vercel.app`.

Then point the host app at it and restart Expo:

```bash
# apps/host-mobile/.env.local
EXPO_PUBLIC_GUEST_URL=https://addasplit.vercel.app
```

Now any scanned QR opens a real URL from any network. The anon key is safe in
the client — it is protected by RLS, and guests reach data only through the
security-definer RPCs.

`apps/guest-web/vercel.json` already carries the pnpm-workspace build commands.

## 3. The host app on a real iPhone

The host is an Expo app, so it does not go through Vercel.

- **Fastest:** `corepack pnpm --filter @addasplit/host-mobile start`, then open
  the project in **Expo Go** on your phone. No Apple account needed.
- **A real installable build:** use EAS —
  `npx eas build --platform ios --profile preview`. Needs an Apple Developer
  account ($99/yr) for device installs, and `eas.json` is already present.
- **TestFlight / App Store:** `npx eas submit`, same Apple account.

Note the native Liquid Glass UI only renders in a real build; Expo Go and the
browser preview fall back to the blur implementation.

## Before real users

The prototype takes shortcuts that must not ship:

- **The host signs in as one seeded demo account** (`ensureHostSession` in
  `apps/host-mobile/lib/supabase.ts`). Real signup/login has to replace it
  before more than one person hosts a bill.
- **Never commit the demo password.** `supabase/setup/02-seed.sql` ships
  `CHANGE_ME` deliberately; the real value belongs only in `.env.local`.
- **Rotate the anon key** if the Supabase project ever held real data during
  prototyping.
- Guests currently refresh on interaction. Supabase Realtime is already in the
  schema if live updates are wanted.
