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

/**
 * Tesseract is far more sensitive to image quality than a cloud vision model,
 * and a phone photo of thermal paper is close to its worst case: grey ink on
 * off-white, uneven lighting, and a shadow down one side. Handing it the raw
 * photo is what makes scans miss lines.
 *
 * Three passes, each cheap and safe:
 *   1. Size so characters are tall enough to recognise — small photos are
 *      upscaled, huge ones capped. Tesseract wants roughly 30px per character.
 *   2. Grayscale by luminance, so ink colour and paper tint stop mattering.
 *   3. Stretch contrast between the 5th and 95th percentiles, which pins faded
 *      ink to black and paper to white without the clipping that a fixed
 *      threshold causes on an unevenly lit receipt.
 */
async function prepareImage(source: string): Promise<HTMLCanvasElement> {
  const image = new Image();
  image.src = source;
  await image.decode().catch(() => { throw new Error('This image format couldn’t be opened. Try a JPEG or PNG photo.'); });

  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  // Upscale a small photo as readily as we cap a large one; too few pixels per
  // character loses more lines than a slow scan does.
  const scale = Math.min(2400 / longest, Math.max(1, 1600 / Math.max(1, image.naturalWidth)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Scanning isn’t supported in this browser. Enter the bill manually.');
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let frame: ImageData;
  try {
    frame = context.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    // A cross-origin or otherwise tainted canvas can't be read; the unprocessed
    // image still scans, just less reliably.
    return canvas;
  }

  const pixels = frame.data;
  const histogram = new Uint32Array(256);
  for (let i = 0; i < pixels.length; i += 4) {
    const grey = (pixels[i]! * 299 + pixels[i + 1]! * 587 + pixels[i + 2]! * 114) / 1000 | 0;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = grey;
    histogram[grey]! += 1;
  }

  const total = canvas.width * canvas.height;
  const percentile = (fraction: number) => {
    let seen = 0;
    const target = total * fraction;
    for (let level = 0; level < 256; level += 1) {
      seen += histogram[level]!;
      if (seen >= target) return level;
    }
    return 255;
  };

  const black = percentile(0.05);
  const white = percentile(0.95);
  // A flat histogram means a blank or uniformly lit frame; stretching it would
  // amplify sensor noise into phantom text.
  if (white - black >= 32) {
    const span = white - black;
    const curve = new Uint8Array(256);
    for (let level = 0; level < 256; level += 1) {
      curve[level] = Math.max(0, Math.min(255, Math.round(((level - black) / span) * 255)));
    }
    for (let i = 0; i < pixels.length; i += 4) {
      const adjusted = curve[pixels[i]!]!;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = adjusted;
    }
  }

  context.putImageData(frame, 0, 0);
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
    await worker.setParameters({
      preserve_interword_spaces: '1',
      // A receipt is one column of text in varying sizes, which is exactly what
      // PSM 4 describes. The default (3, fully automatic) hunts for a page
      // layout that isn't there and often splits the item and price columns
      // into separate blocks, which breaks line-by-line parsing.
      tessedit_pageseg_mode: '4' as never,
    });
    const { data } = await worker.recognize(canvas);
    const parsed = parseReceipt(data.text);
    if (!data.text.trim()) throw new Error('No text was found. Photograph the whole receipt, flat and well lit.');
    if (data.confidence < 65) parsed.warnings.unshift('The photo was difficult to read. Check every item and amount carefully.');
    return parsed;
  };
  try { return await Promise.race([run(), cancelled]); }
  finally { clearTimeout(timeout); signal?.removeEventListener('abort', onAbort); terminate(); }
}
