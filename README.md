# SplitPay

**Good food. Fair splits.** A bill-splitting product for Bangladesh: the host
enters a receipt, friends claim what they ordered through a browser link, and
pay the host externally using bKash or Nagad. Guests never need an account or app.

## Current status

This repository contains a runnable **prototype**, not a production-ready MVP.

- Expo host with a redesigned home, Home/Splits/Profile navigation, editable
  receipt review, reconciliation gating, and a demo QR sharing screen.
- Native iOS presentation: UIKit tabs, SF Symbols, and native Liquid Glass on
  supported iOS 26 builds. Older iOS uses blur; Reduce Transparency uses opaque
  surfaces. The browser uses a separate frosted-glass implementation.
- Next.js guest demo: quantity selection, name confirmation, sample payment
  instructions, and a local payment-reported state.
- Pure integer-taka split engine with deterministic remainder allocation and
  16 unit tests, plus browser tests for sign-in and the host-to-guest payment flow.
- PostgreSQL/Supabase schema with RLS, security-definer guest RPCs, and a
  row-locking claim path, connected to both apps and verified against a live
  database.
- Host accounts with email sign-up and sign-in, a persisted session, saved
  bKash/Nagad numbers, and a history of every split with what is still owed.
- Host publishes a draft to a real split and shares a working QR; guests claim
  through it with no account; a live tracking screen shows who claimed what and
  lets the host mark payments received, which the guest sees without reloading.

**Current limits:** Camera/photo receipt scanning is implemented through a server-side
Anthropic endpoint, but still needs live validation, endpoint authentication and rate limits.
Shared-item splitting exists in the schema but not the UI, and host and guest updates use five-second polling. Payment confirmation is host-attested;
there is no bKash/Nagad API integration. Native JavaScript export is not an
Xcode compilation or a physical-device validation.

## Workspace

```text
apps/
  host-mobile/       Expo SDK 54 · React Native · native iOS + browser preview
  guest-web/         Next.js · anonymous guest browser flow
packages/
  split-engine/      Framework-free calculations and unit tests
  types/             Shared payment/split status definitions
  ui/                Initial shared color tokens
supabase/migrations/ Initial database schema and policies
tests/browser/       Host rendering and manual-entry regression check
docs/
  implementation-plan.md
  ios-implementation.md
```

## Install and preview

Use a supported Node.js LTS release (Node 22.13+ is suitable) with Corepack.

```bash
corepack pnpm install
corepack pnpm dev:host:web
```

Open the host URL printed by Expo, normally `http://localhost:8081`.
Start the guest app in another terminal:

```bash
corepack pnpm dev:guest
```

Open the guest link the host app's share screen prints.

**Scanning the QR from a phone needs a reachable address** — `localhost` will
not resolve. See [docs/deployment.md](docs/deployment.md); the quickest fix is
setting `EXPO_PUBLIC_GUEST_URL` to your machine's LAN IP.

## Backend setup

The apps need a Supabase project. Run `supabase/setup/01-schema.sql` then
`supabase/setup/02-seed.sql` (replace `CHANGE_ME` first) in the SQL editor, then
fill in:

- `apps/guest-web/.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `apps/host-mobile/.env.local` — `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_GUEST_URL`, `EXPO_PUBLIC_DEMO_HOST_EMAIL`, `EXPO_PUBLIC_DEMO_HOST_PASSWORD`

These files are gitignored. Never commit the host password.

After dependency or Metro configuration changes, stop the old host server with
Ctrl+C, then run `corepack pnpm dev:host:web --clear`.

## Native iOS

The iOS renderer uses Apple's native material through `expo-glass-effect`, not
a CSS approximation. It shares the app's screens and bill logic with other
platforms. Native tabs and glass have dedicated `.ios.tsx` implementations.

With Xcode installed, its license accepted, first-launch setup completed, and an
iOS simulator runtime available:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer corepack pnpm --filter @splitpay/host-mobile ios:native
```

Xcode 26+ and iOS 26 are needed to inspect actual Liquid Glass. See
[native iOS setup and deployment prerequisites](docs/ios-implementation.md).
EAS simulator/store profiles are provided; production requires your registered
Apple bundle identifier. No signed build or App Store submission has been made.

## Verification

```bash
corepack pnpm test
corepack pnpm typecheck
corepack pnpm --filter @splitpay/guest-web build
corepack pnpm --filter @splitpay/host-mobile build:web
corepack pnpm --filter @splitpay/host-mobile build:ios:js
corepack pnpm --filter @splitpay/host-mobile exec expo install --check
```

Browser checks (start a local test backend on 54329, Expo on 8082, and Next.js on 3002):

```bash
corepack pnpm exec playwright install chromium
corepack pnpm test:host:web
```

Alternatively, with Google Chrome installed:

```bash
PLAYWRIGHT_CHANNEL=chrome corepack pnpm test:host:web
```

The tests keep host sign-in required and exercise session persistence, bill editing,
reconciliation, publishing, anonymous guest claiming, payment reporting, and host
confirmation. They use an in-memory Supabase contract fixture and fake credentials;
no live database writes or real payments occur. Screenshots are written to ignored
`test-results/`. These checks do not validate database RLS, concurrency, native iOS,
or the live OCR service.

## Next milestone

Validate the complete flow against Supabase on two devices, protect the OCR endpoint,
and complete native-device checks. Partial claims now reserve unclaimed charges;
whole-taka rounding can still adjust a guest's preview as the table finishes claiming.
See the [implementation plan](docs/implementation-plan.md) for remaining work.
