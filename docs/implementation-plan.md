# AddaSplit implementation plan

## Implemented foundation

- pnpm workspaces, Turborepo task configuration, strict TypeScript, Expo host,
  Next guest, and initial shared packages. Turbo orchestration/linting still
  need to be wired into the root scripts.
- Pure integer-taka split engine with 11 unit tests.
- Host home, review/edit, reconciliation gate, demo QR, draft list, appearance
  settings, and platform-specific native iOS presentation.
- Guest selection/name/payment demo, using local component state.
- Initial Supabase migration with host policies and a row-locking claim function.
- Browser regression test for host rendering, manual entry, and demo sharing.

These screens do not yet form a persistent, multi-device vertical slice. Native
Liquid Glass is implemented but requires a native build and iOS 26 device
validation. The guest visual redesign is still pending beyond its original UI.

## Next vertical slice

1. Configure Supabase, host authentication, and a validated API/repository layer.
2. Save a manually entered bill and generate its unguessable public link.
3. Server-render that bill through a safe public endpoint; reject unknown tokens.
4. Persist an anonymous guest session and atomically save quantities.
5. Persist display name and confirmation; host reads guest and allocated amount.
6. Test the complete path on two separate devices before extending the flow.

## Complete the manual MVP

- Explicit shared-item groups, including unresolved participants.
- Realtime claims, confirmations and payment states; quantity-conflict messaging.
- Server-authoritative calculations for every client. The guest currently uses
  independently rounded preview charges instead of the shared engine.
- Correct partial-claim charge treatment, input limits, excessive discounts,
  zero-subtotal cases, and meaningful rounding-adjustment reporting in the engine.
- Database guest-session authorization, idempotency, lifecycle transitions, and
  adversarial RLS/concurrency tests. The draft migration is not production-vetted.
- Host live tracking, unclaimed items, payment confirmation/undo, safe closing.
- Persistent history, balances, profile/payment settings, and host self-claiming.

## Release work

- Complete the guest visual refresh from the provided reference, retaining its
  lightweight browser flow. Bangla localization, dynamic type, dark mode and
  accessibility checks across 360–430px layouts and native iOS.
- Network retry/recovery, loading/error states, receipt reconciliation tests,
  diagnostics/telemetry with appropriate data handling.
- Deploy the guest site and backend; configure the real public URL.
- Native build/signing, icon and store assets, privacy/support information,
  physical-device checks, and TestFlight validation. See `ios-implementation.md`.
- Receipt camera/storage/OCR only after the manual flow works end to end.

## Money rules

Store whole integer taka. Distribute item amounts and prorate fixed VAT, service
charge, and discount by pre-charge item subtotal with deterministic remainder
allocation. Preserve every taka for a fully claimed, reconciled bill. Unclaimed
items and incomplete confirmations must block settlement. The current engine
needs the partial-claim and edge-case hardening listed above before real use.
