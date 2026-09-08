import { readFile, writeFile } from 'node:fs/promises';

/**
 * Expo's web export writes a bare index.html, so the tags that make this
 * installable have to be added afterwards.
 *
 * The one that matters most is apple-touch-icon: iOS ignores the web manifest's
 * icons entirely when adding to the home screen, and without a PNG at that link
 * it saves a screenshot of the page instead of an app icon — which is the
 * difference between something that looks installed and something that looks
 * like a bookmark.
 */
const file = new URL('../dist/index.html', import.meta.url);
let html = await readFile(file, 'utf8');

html = html.replace(/<title>.*?<\/title>/, '<title>SplitSave</title>');

// viewport-fit=cover lets the app paint under the notch and home indicator,
// which is what stops a standalone app looking letterboxed on a modern iPhone.
html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />',
);

const head = [
  '<link rel="manifest" href="/manifest.webmanifest">',
  '<link rel="icon" href="/icon.svg" type="image/svg+xml">',
  '<link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png">',
  // iOS reads only this for the home-screen icon.
  '<link rel="apple-touch-icon" href="/icon-180.png">',
  '<meta name="theme-color" content="#245C45">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="SplitSave">',
  // Translucent lets the app background run to the top of the screen instead
  // of leaving an opaque bar in a colour that is not ours.
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="format-detection" content="telephone=no">',
].join('');

html = html.replace('</head>', `${head}</head>`);
await writeFile(file, html);
