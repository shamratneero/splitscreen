# SplitSave interface

The interface uses warm paper colors, deep green actions, and receipt details to connect the host and guest experiences. Keep money and the next action easy to find.

- Use system sans-serif for controls and amounts. Georgia is reserved for introductory headlines and guest page titles; no external font request is needed to render a page.
- Light colors: paper `#FAF9F6`, ink `#202B26`, muted text `#68716A`, green `#245C45`, borders `#E4E5DD`. Use the theme's lighter green for text in dark mode, with white text on the deep green primary button.
- Use tabular numerals for amounts, dates, quantities, and payment numbers. Format amounts through `@splitsave/types`, including when copying a decimal currency amount.
- Use 24px page gutters, 12–16px control and card corners, 44px minimum touch targets, visible keyboard focus, and reduced-motion support.
- The host's primary action is starting a split; returning hosts also see outstanding payments. New manual bills start empty.
- Guests follow Choose → Review → Pay. Keep their amount and next action at the bottom. Sharing a dish starts after claiming it, and the person creating the shared claim remains included.
- Dialogs keep keyboard focus inside, return focus when closed, and prevent duplicate submissions while saving. Error and empty states explain what someone can do next.

Host primitives live in `apps/host-mobile/components/ui.tsx` and `theme.tsx`. Guest styles live in `apps/guest-web/app/styles.css`; `bill-chrome.tsx` provides the matching brand and progress indicator.

The browser suite covers the main host-to-guest flow, local OCR review, 320px/390px/1440px layouts, dark mode, dialog keyboard behavior, and currency copying. Its local backend deliberately rejects Realtime channel joins to exercise polling; it does not validate the production Realtime service.
