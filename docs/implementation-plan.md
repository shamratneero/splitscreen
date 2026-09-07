# AddaSplit implementation plan

## Implemented

- Expo host with required email sign-in, persisted sessions, payment-number settings,
  manual receipt editing, reconciliation, publishing, QR links, tracking and history.
- Anonymous Next.js guest flow with persistent claims, name confirmation, payment
  reporting, and five-second polling for host confirmation.
- Shared integer-taka engine with proportional charges reserved for unclaimed items,
  deterministic remainder allocation, and 16 unit tests.
- Camera/photo selection and server-side receipt extraction, followed by editable review.
- Native iOS tabs and glass, with platform and accessibility fallbacks.
- Browser tests using an isolated in-memory backend: required sign-in, session restore,
  bill creation, partial claims, payment reporting and host confirmation.
- Minimal host surfaces, persistent sign-in labels, password visibility, keyboard
  submission, clearer guest selection, and a return path from confirmation to items.

## Before real use

- Validate the host-to-guest flow against Supabase on two devices. The browser fixture
  verifies client integration, not database policies, authorization or concurrency.
- Authenticate and rate-limit OCR requests; validate live extraction and failure cases.
- Server-authoritative totals and payment lifecycle: freeze or reconcile payable
  amounts before settlement, including whole-taka rounding changes as guests join.
- Harden input limits, excessive discounts, zero-subtotal cases and rounding reporting.
- Transactional/idempotent publishing, payment undo, safe closing and host self-claiming.
- Explicit shared-item UI and adversarial guest-session/RLS/concurrency tests.
- Network retry/recovery and accessible layouts across native devices and narrow screens.

## Release

Deploy the guest site and configure its public URL. Validate native iOS builds and
Liquid Glass on supported devices, then complete signing, store assets, privacy/support
information and TestFlight checks. See `deployment.md` and `ios-implementation.md`.
