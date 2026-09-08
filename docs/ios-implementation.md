# Native iOS implementation

The host remains a React Native/Expo app with platform-specific native presentation.
Bill state and the TypeScript split engine are shared. It is not a separate SwiftUI
application or a web page wrapped in an iOS WebView.

## Native surfaces

- `apps/host-mobile/app/(tabs)/_layout.ios.tsx` uses Expo Router's UIKit-backed
  native tabs, with SF Symbols for Home, Splits, and Profile.
- `apps/host-mobile/components/glass-surface.ios.tsx` uses `expo-glass-effect`'s
  native `UIVisualEffectView`. Both runtime and build availability are checked.
- iOS 26 uses Liquid Glass; older supported iOS uses a native material blur.
  Reduce Transparency selects an opaque, high-contrast surface and listens for
  changes. Native tabs follow the system accessibility setting.
- Glass surfaces and their ancestors do not animate opacity. Primary actions
  use an opaque green fill for legibility; content panels remain readable.
- `glass-surface.web.tsx` uses browser backdrop blur. Android gets an opaque
  fallback. The browser appearance is an approximation, not native Liquid Glass.
- Light/dark appearance, safe-area padding, native share sheet, and primary-action
  selection haptics are integrated. SF Symbols are provided by UIKit tabs.

The host is on Expo SDK 54, React Native 0.81.5, and its supported React 19.1.0.
Metro scopes React to the host so the Next guest's React version cannot enter the
host bundle. Keep `corepack pnpm --filter @splitpay/host-mobile exec expo install --check`
passing when changing native dependencies.

References: [Expo GlassEffect](https://docs.expo.dev/versions/v54.0.0/sdk/glass-effect/),
[Apple materials](https://developer.apple.com/design/human-interface-guidelines/materials).

## Run and verify locally

Browser preview:

```bash
corepack pnpm dev:host:web --clear
```

Native iOS, from the repository root:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer corepack pnpm --filter @splitpay/host-mobile ios:native
```

This generates the iOS project and compiles it with Xcode. Native dependency
installation requires CocoaPods. A real iOS 26 device or simulator and a build
using Xcode 26+ are required to validate Liquid Glass. The latest App Store Expo
Go may not support this project's SDK; use the native development build above.

On this Mac, Xcode 26.6 is installed, but Xcode's license is not accepted and the
active developer directory points at Command Line Tools. Open Xcode, personally
review/accept the license, complete first-launch setup, and install an iOS 26
simulator runtime. The `DEVELOPER_DIR` command above selects Xcode without changing
the global toolchain. License acceptance has not been performed by the agent.

An iOS JavaScript export is a useful check but does not compile Swift/Objective-C
or verify UIKit rendering:

```bash
corepack pnpm --filter @splitpay/host-mobile build:ios:js
PLAYWRIGHT_CHANNEL=chrome corepack pnpm test:host:web
```

## Build configuration for distribution

`eas.json` has simulator and App Store build profiles. A preview has bundle ID
`dev.splitpay.preview`. A production build requires `IOS_BUNDLE_IDENTIFIER` from
your registered Apple application; it deliberately fails instead of assuming one.

Before a TestFlight build:

1. Finish persistent bills, host authentication, guest claims, payments tracking,
   backend security checks, and the real hosted guest URL. The current QR still
   opens demo data, and this is disclosed on the share screen.
2. Set the real bundle identifier and guest URL in the build environment; link
   the app to the correct Expo account/project and Apple Developer team.
3. Supply the final app icon, screenshots, privacy policy, support URL, and
   accurate privacy/encryption declarations. No account signing credentials are
   stored in this repository.
4. Check the current App Store SDK requirements and select a compatible Xcode
   image. EAS build configuration alone is not a signed or submitted application.
5. Validate native light/dark mode, VoiceOver, large text, Reduce Transparency,
   keyboard behavior, and the receipt flow on a physical device before release.

No cloud build, paid service, App Store record, or submission has been created.
