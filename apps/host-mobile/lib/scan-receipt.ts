export { captureReceipt } from './capture-receipt';
export type { CaptureSource } from './capture-receipt';
export type { ParsedReceipt as ScannedReceipt } from '@splitsave/receipt-parser';
import type { ParsedReceipt } from '@splitsave/receipt-parser';

/**
 * Whether receipt scanning can run here.
 *
 * The scanner is Tesseract compiled to WebAssembly, driven by a web worker. A
 * React Native runtime has neither, so a packaged build cannot run it — the web
 * build can, and does. Exporting this as a flag lets the UI offer manual entry
 * plainly instead of showing a camera button that fails after the photo is
 * taken, which is the worse of the two experiences.
 */
export const scanningAvailable = false;

export async function scanReceipt(
  _base64: string,
  _mediaType: string,
  _onProgress?: (message: string) => void,
  _signal?: AbortSignal,
): Promise<ParsedReceipt> {
  throw new Error('Receipt scanning runs in the browser version of SplitSave. Enter this bill manually instead.');
}
