import { requireOptionalNativeModule } from 'expo';

export type StructuredItem = { name: string; quantity: number; unitPrice: number };
export type StructuredReceipt = {
  merchant: string;
  items: StructuredItem[];
  vat: number;
  serviceCharge: number;
  discount: number;
  total: number;
};

type ReceiptVisionModule = {
  recognize(base64: string): Promise<{ text: string; confidence: number }>;
  /** Null when the device has no on-device model available. */
  structure(text: string): Promise<StructuredReceipt | null>;
};

/**
 * Apple's Vision framework reads the text; Apple's on-device model reads the
 * layout. Both run on the phone, cost nothing, need no key, and never send the
 * receipt anywhere.
 *
 * Optional so a build without the native module degrades to manual entry
 * rather than crashing.
 */
const native = requireOptionalNativeModule<ReceiptVisionModule>('ReceiptVisionModule');

export const visionAvailable = native !== null;

export async function recognizeReceipt(base64: string): Promise<{ text: string; confidence: number }> {
  if (!native) throw new Error('Receipt scanning is not available in this build.');
  return native.recognize(base64);
}

/** Returns null when the model is unavailable, so the caller can fall back. */
export async function structureReceipt(text: string): Promise<StructuredReceipt | null> {
  if (!native) return null;
  try {
    return await native.structure(text);
  } catch {
    // A declined or failed generation is not fatal — the rules parser still runs.
    return null;
  }
}
