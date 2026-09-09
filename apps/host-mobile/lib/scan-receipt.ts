export { captureReceipt } from './capture-receipt';
export type { CaptureSource } from './capture-receipt';
export type { ParsedReceipt as ScannedReceipt } from '@splitup/receipt-parser';
import { parseReceipt, type ParsedReceipt } from '@splitup/receipt-parser';
import { recognizeReceipt, structureReceipt, visionAvailable } from '../modules/receipt-vision';

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

  /**
   * Ask the on-device model to read the layout first.
   *
   * Receipt formats differ too much for a line parser: a restaurant puts the
   * name beside the price, a supermarket puts a product code and the numbers on
   * one line with the name on the next. The model reads whichever it is given.
   * The rules parser stays as the fallback for when no model is available.
   */
  onProgress('Working out the items…');
  const structured = await structureReceipt(text);
  if (signal?.aborted) throw new Error('Scan cancelled.');

  if (structured && structured.items.length > 0) {
    const items = structured.items
      .filter(item => item.name?.trim())
      .map((item, index) => ({
        id: `ai-${Date.now()}-${index}`,
        name: item.name.trim(),
        quantity: Math.max(1, Math.round(item.quantity)),
        price: Math.max(0, Math.round(item.unitPrice)),
      }));

    if (items.length > 0) {
      const receipt: ParsedReceipt = {
        restaurantName: structured.merchant?.trim() ?? '',
        items,
        vat: Math.max(0, Math.round(structured.vat)),
        serviceCharge: Math.max(0, Math.round(structured.serviceCharge)),
        discount: Math.max(0, Math.round(structured.discount)),
        receiptTotal: Math.max(0, Math.round(structured.total)),
        warnings: [],
        rawText: text,
      };

      const computed =
        items.reduce((sum, item) => sum + item.quantity * item.price, 0) +
        receipt.vat + receipt.serviceCharge - receipt.discount;
      if (receipt.receiptTotal > 0 && computed !== receipt.receiptTotal) {
        receipt.warnings.push('Extracted items and charges do not match the receipt total. Check for missing or incorrect lines.');
      }
      if (confidence < 55) {
        receipt.warnings.unshift('The photo was difficult to read. Check every item and amount carefully.');
      }
      return receipt;
    }
  }

  const parsed = parseReceipt(text);
  parsed.warnings.unshift('Read line by line — check every item against the receipt.');
  if (confidence < 55) {
    parsed.warnings.unshift('The photo was difficult to read. Check every item and amount carefully.');
  }
  return parsed;
}
