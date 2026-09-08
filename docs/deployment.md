# Deploying SplitSave

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

   Both are public by design; the anon key is protected by RLS. There is no
   secret to set — receipt scanning runs in the host's browser, not on a server.
5. Deploy. You get something like `https://splitsave.vercel.app`.

Then point the host app at it and restart Expo:

```bash
# apps/host-mobile/.env.local
EXPO_PUBLIC_GUEST_URL=https://splitsave.vercel.app
```

Now any scanned QR opens a real URL from any network. The anon key is safe in
the client — it is protected by RLS, and guests reach data only through the
security-definer RPCs.

`apps/guest-web/vercel.json` already carries the pnpm-workspace build commands.

## 3. The host app on Vercel (second project, same repo)

**The whole product ships for $0.** Guests never install anything by design, and
the host app is a static site — receipt scanning runs in the browser, so there
is no server and no API key.

The two apps are **two Vercel projects pointed at the same repository**, each
with its own Root Directory. Vercel allows this; the Root Directory is what
keeps them apart.

1. At [vercel.com/new](https://vercel.com/new), import the **same** repository
   a second time.
2. **Set Root Directory to `apps/host-mobile`.**
3. Leave the build settings alone — `apps/host-mobile/vercel.json` already
   carries the install/build commands, the `dist` output directory, and the SPA
   rewrite that keeps `/track/<id>` working on refresh.
4. Add one Environment Variable:
   - `EXPO_PUBLIC_GUEST_URL` — the guest app's deployed URL, so shared QR codes
     point at it rather than `localhost`.
5. Deploy, then set the same value in `apps/host-mobile/.env.local` for local runs.

Hosts can *Add to Home Screen* for a full-screen, own-icon install — the
`manifest.webmanifest` and icon are already in `public/`.

### Why the build is ~56 MB

`build:web` runs `scripts/prepare-ocr.mjs`, which copies the Tesseract WASM
cores and the English and Bengali training data out of `node_modules` into
`public/ocr/`. Those files are **generated, not committed** (`.gitignore` skips
`public/ocr/`, `.vercelignore` skips it on upload), so the build regenerates
them every time — nothing is fetched from the network at build or run time.

All WASM core variants ship because Tesseract picks one at runtime based on the
browser's SIMD support; the visitor downloads only the one they need, plus the
language data.

The `vercel.json` route returning 404 for missing `/ocr/*` paths is deliberate:
without it, a missing asset would fall through to the SPA rewrite and return
`index.html`, and the WASM loader would fail with a confusing parse error
instead of an honest 404.

What the web build costs you: the native Liquid Glass rendering falls back to a
CSS blur, and there is no App Store listing.

### Paid path, only when you need it

The $99/yr Apple Developer Program buys App Store distribution and TestFlight —
nothing else. Pay it when users ask for a store listing, not before; it renews
annually, so every year paid early is wasted.

## 4. Native iOS builds

The host is an Expo app, so it does not go through Vercel.

- **Fastest:** `corepack pnpm --filter @splitsave/host-mobile start`, then open
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

## 5. Packaging for an iPhone

Two different things are called "an iOS app", and they cost very differently.

### Install from the browser (free, works today)

The deployed host app is a PWA. On the iPhone, open it in **Safari** (not
Chrome — only Safari can install to the home screen), tap Share, then **Add to
Home Screen**. It gets its own icon, launches without browser chrome, and
**receipt scanning still works**, because it is the same web build.

The tags that make this work are injected by `scripts/finalize-web.mjs`. The
one that matters is `apple-touch-icon`: iOS ignores the web manifest's icons
entirely, and without a PNG at that link it saves a screenshot of the page
instead of an app icon.

### A real installable build (needs Apple)

`eas.json` and `app.config.ts` are ready — app icon, camera and photo-library
usage descriptions, bundle identifier from the environment. Verify the native
project generates at any time:

```bash
cd apps/host-mobile
IOS_BUNDLE_IDENTIFIER=com.yourcompany.splitsave APP_VARIANT=production \
  npx expo prebuild --platform ios --no-install --clean
```

`ios/` is generated, gitignored, and safe to delete. Then build in the cloud —
no local Xcode required:

```bash
npx eas build --platform ios --profile production
npx eas submit --platform ios
```

This needs an Apple Developer account ($99/yr) for TestFlight or the App Store.

**Scanning does not work in a packaged build.** The scanner is Tesseract
compiled to WebAssembly driven by a web worker; a React Native runtime has
neither. `scanningAvailable` is false there, so the home screen offers manual
entry rather than a camera button that fails after the photo is taken. Giving
the packaged app its own scanner means either Apple's Vision framework through
a native module, or hosting the web scanner in a WebView.

### Both at once

Nothing here affects Vercel. `build:web` is unchanged, the OCR assets still
ship, and the two apps deploy exactly as before — the native configuration only
matters when `expo prebuild` or `eas build` runs.
