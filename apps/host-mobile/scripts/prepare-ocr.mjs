import { createRequire } from 'node:module';
import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const target = fileURLToPath(new URL('../public/ocr/', import.meta.url));
await mkdir(path.join(target, 'core'), { recursive: true });
const tesseract = path.dirname(require.resolve('tesseract.js/package.json'));
for (const name of ['tesseract.min.js', 'worker.min.js']) await cp(path.join(tesseract, 'dist', name), path.join(target, name));
const core = path.dirname(require.resolve('tesseract.js-core', { paths: [tesseract] }));
for (const name of await readdir(core)) {
  if (/\.wasm(?:\.js)?$/.test(name)) await cp(path.join(core, name), path.join(target, 'core', name));
}
for (const lang of ['eng', 'ben']) {
  const root = path.dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`));
  await cp(path.join(root, '4.0.0_best_int', `${lang}.traineddata.gz`), path.join(target, `${lang}.traineddata.gz`));
}
console.log('Prepared local English/Bengali OCR assets.');
