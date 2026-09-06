# AddaSplit

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
  11 unit tests, plus a host browser regression test.
- Initial PostgreSQL/Supabase schema, RLS baseline, and row-locking claim RPC.
  These are not yet connected to the apps or verified against a live database.

**Current limits:** drafts and guest claims are held in memory and reset on
reload. The QR opens sample data, not the host's newly entered bill. Payment
numbers are placeholders. Guest amounts still use a separate preview calculation.
Camera/OCR, authentication, persistent claims, realtime tracking, and settlement
remain to be implemented. Native JavaScript export is not an Xcode compilation
or a physical-device validation.

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

Open `http://localhost:3000/s/demo-sultans-dine`.

After dependency or Metro configuration changes, stop the old host server with
Ctrl+C, then run `corepack pnpm dev:host:web --clear`.

## Native iOS

The iOS renderer uses Apple's native material through `expo-glass-effect`, not
a CSS approximation. It shares the app's screens and bill logic with other
platforms. Native tabs and glass have dedicated `.ios.tsx` implementations.

With Xcode installed, its license accepted, first-launch setup completed, and an
iOS simulator runtime available:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer corepack pnpm --filter @addasplit/host-mobile ios:native
```

Xcode 26+ and iOS 26 are needed to inspect actual Liquid Glass. See
[native iOS setup and deployment prerequisites](docs/ios-implementation.md).
EAS simulator/store profiles are provided; production requires your registered
Apple bundle identifier. No signed build or App Store submission has been made.

## Verification

```bash
corepack pnpm test
corepack pnpm typecheck
corepack pnpm --filter @addasplit/guest-web build
corepack pnpm --filter @addasplit/host-mobile build:web
corepack pnpm --filter @addasplit/host-mobile build:ios:js
corepack pnpm --filter @addasplit/host-mobile exec expo install --check
```

Browser smoke check (starts a temporary Expo server on port 8082):

```bash
corepack pnpm exec playwright install chromium
corepack pnpm test:host:web
```

Alternatively, with Google Chrome installed:

```bash
PLAYWRIGHT_CHANNEL=chrome corepack pnpm test:host:web
```

The test verifies rendering, manual edits, and navigation to the demo share
screen without browser runtime errors. Screenshots are written to ignored
`test-results/`. It does not verify native iOS rendering or backend behavior.

## Next milestone

Connect a saved host bill to its unique public link, persist an anonymous guest's
claim and confirmation, and show the guest's amount on the host screen. See the
[implementation plan](docs/implementation-plan.md) for the remaining work.
