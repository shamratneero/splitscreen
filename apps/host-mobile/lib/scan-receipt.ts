export { captureReceipt } from './capture-receipt';
export type { CaptureSource } from './capture-receipt';
export type { ParsedReceipt as ScannedReceipt } from '@splitsave/receipt-parser';
import { parseReceipt, type ParsedReceipt } from '@splitsave/receipt-parser';
import { recognizeReceipt, visionAvailable } from '../modules/receipt-vision';

/**
 * Whether receipt scanning can run here.
 *
 * The packaged app reads receipts with Apple's Vision framework — on-device,
 * offline, and trained on photographed documents, which is the case Tesseract
 * handled worst. The web build cannot reach Vision, so it keeps the
 * WebAssembly scanner; both feed the same parser.
 */
export const scanningAvailable = visionAvailable;

export async function scanReceipt(
  base64: string,
  _mediaType: string,
  onProgress: (message: string) => void = () => {},
  signal?: AbortSignal,
): Promise<ParsedReceipt> {
  if (signal?.aborted) throw new Error('Scan cancelled.');
  onProgress('Reading your receipt…');

  const { text, confidence } = await recognizeReceipt(base64);
  if (signal?.aborted) throw new Error('Scan cancelled.');
  if (!text.trim()) {
    throw new Error('No text was found. Photograph the whole receipt, flat and well lit.');
  }

  const parsed = parseReceipt(text);
  // Vision reports its own certainty; a low score means every line is suspect,
  // not just the ones the parser flagged.
  if (confidence < 55) {
    parsed.warnings.unshift('The photo was difficult to read. Check every item and amount carefully.');
  }
  return parsed;
}
