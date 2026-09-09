import { requireOptionalNativeModule } from 'expo';

type ReceiptVisionModule = {
  /** Recognises text in an image, returning it as lines top-to-bottom. */
  recognize(base64: string): Promise<{ text: string; confidence: number }>;
};

/**
 * Apple's Vision framework, on-device.
 *
 * Free, private, offline, and considerably better than Tesseract on a
 * photographed receipt — Apple trained it on exactly this kind of imagery.
 * The web build keeps Tesseract because a browser cannot reach Vision.
 *
 * Optional so the module's absence degrades to manual entry rather than
 * crashing a build that has not been prebuilt yet.
 */
const native = requireOptionalNativeModule<ReceiptVisionModule>('ReceiptVisionModule');

export const visionAvailable = native !== null;

export async function recognizeReceipt(base64: string): Promise<{ text: string; confidence: number }> {
  if (!native) throw new Error('Receipt scanning is not available in this build.');
  return native.recognize(base64);
}
