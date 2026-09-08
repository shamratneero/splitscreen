export { captureReceipt } from './capture-receipt';
export type { CaptureSource } from './capture-receipt';
export type { ParsedReceipt as ScannedReceipt } from '@addasplit/receipt-parser';
import type { ParsedReceipt } from '@addasplit/receipt-parser';

export async function scanReceipt(_base64: string, _mediaType: string, _onProgress?: (message: string) => void, _signal?: AbortSignal): Promise<ParsedReceipt> {
  throw new Error('Free receipt scanning is available in the web app. Open AddaSplit in your browser, or enter this bill manually.');
}
