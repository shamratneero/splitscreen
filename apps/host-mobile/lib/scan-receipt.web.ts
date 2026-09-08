import { parseReceipt, type ParsedReceipt } from '@addasplit/receipt-parser';
import type { Worker } from 'tesseract.js';
export type { CaptureSource } from './capture-receipt';
export type { ParsedReceipt as ScannedReceipt } from '@addasplit/receipt-parser';
import type { CaptureSource } from './capture-receipt';

declare global { interface Window { Tesseract?: typeof import('tesseract.js') } }
let loading: Promise<void> | undefined;
function loadEngine(): Promise<void> {
  if (window.Tesseract) return Promise.resolve();
  if (!loading) loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => { clearTimeout(timer); script.remove(); loading = undefined; reject(new Error('Couldn’t load the scanner. Check your connection and try again.')); };
    const timer = setTimeout(fail, 30000);
    script.src = '/ocr/tesseract.min.js';
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}

/** Invoke the picker synchronously from the tap, as mobile browsers require. */
export function captureReceipt(source: CaptureSource): Promise<{ base64: string; mediaType: string } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    if (source === 'camera') input.setAttribute('capture', 'environment');
    input.style.display = 'none'; document.body.appendChild(input);
    input.oncancel = () => { input.remove(); resolve(null); };
    input.onchange = async () => {
      const file = input.files?.[0]; input.remove();
      if (!file) return resolve(null);
      if (file.size > 15 * 1024 * 1024) return reject(new Error('That image is too large. Choose a photo smaller than 15 MB.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Couldn’t open that photo. Try a JPEG or PNG.'));
      reader.onload = () => resolve({ base64: String(reader.result).split(',')[1]!, mediaType: file.type || 'image/jpeg' });
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

async function prepareImage(source: string): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = source;
  await image.decode().catch(() => { throw new Error('This image format couldn’t be opened. Try a JPEG or PNG photo.'); });
  const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Scanning isn’t supported in this browser. Enter the bill manually.');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function scanReceipt(base64: string, mediaType: string, onProgress: (message: string) => void = () => {}, signal?: AbortSignal): Promise<ParsedReceipt> {
  if (signal?.aborted) throw new Error('Scan cancelled.');
  let worker: Worker | undefined;
  let stopped = false;
  const terminate = () => { stopped = true; if (worker) void worker.terminate(); };
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => { terminate(); reject(new Error('Scan cancelled.')); };
    signal?.addEventListener('abort', onAbort, { once: true });
    timeout = setTimeout(() => { terminate(); reject(new Error('Scanning took too long. Try a smaller, clearer photo or enter the bill manually.')); }, 120000);
  });
  const run = async () => {
    onProgress('Loading the scanner…');
    await loadEngine();
    if (stopped) throw new Error('Scan cancelled.');
    const canvas = await prepareImage(`data:${mediaType};base64,${base64}`);
    if (stopped) throw new Error('Scan cancelled.');
    worker = await window.Tesseract!.createWorker(['eng', 'ben'], 1, {
      workerPath: '/ocr/worker.min.js', corePath: '/ocr/core', langPath: '/ocr', workerBlobURL: false,
      logger: message => {
        if (stopped) return;
        onProgress(message.status === 'recognizing text' ? `Reading receipt… ${Math.round(message.progress * 100)}%` : 'Preparing English and Bengali scanning…');
      },
    });
    if (stopped) { await worker.terminate(); throw new Error('Scan cancelled.'); }
    await worker.setParameters({ preserve_interword_spaces: '1' });
    const { data } = await worker.recognize(canvas);
    const parsed = parseReceipt(data.text);
    if (!data.text.trim()) throw new Error('No text was found. Photograph the whole receipt, flat and well lit.');
    if (data.confidence < 65) parsed.warnings.unshift('The photo was difficult to read. Check every item and amount carefully.');
    return parsed;
  };
  try { return await Promise.race([run(), cancelled]); }
  finally { clearTimeout(timeout); signal?.removeEventListener('abort', onAbort); terminate(); }
}
