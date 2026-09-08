import { readFile, writeFile } from 'node:fs/promises';
const file = new URL('../dist/index.html', import.meta.url);
let html = await readFile(file, 'utf8');
html = html.replace(/<title>.*?<\/title>/, '<title>SplitSave</title>');
html = html.replace('</head>', '<link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icon.svg" type="image/svg+xml"><meta name="theme-color" content="#245C45"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="SplitSave"></head>');
await writeFile(file, html);
