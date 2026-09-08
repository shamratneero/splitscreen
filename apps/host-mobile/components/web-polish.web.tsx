import { createElement } from 'react';
import { useTheme } from './theme';

export function WebPolish() {
  const { colors, isDark } = useTheme();
  return createElement('style', null, `
    :root { color-scheme: ${isDark ? 'dark' : 'light'}; }
    body { -webkit-font-smoothing: antialiased; }
    [role="button"], [role="tab"], input { transition: background-color 150ms, border-color 150ms, opacity 150ms; }
    [role="button"]:focus-visible, [role="tab"]:focus-visible, [role="radio"]:focus-visible, [role="checkbox"]:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${colors.primary}; outline-offset: 3px; }
    input { caret-color: ${colors.primary}; }
    @media (hover: hover) { [role="button"]:not([aria-disabled="true"]):hover { opacity: .85; } }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; } }
  `);
}
