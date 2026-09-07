import * as ImagePicker from 'expo-image-picker';
import { resolveGuestBaseURL } from './guest-url';
import type { DraftItem } from '../state/draft';

export type ScannedReceipt = {
  restaurantName: string;
  items: DraftItem[];
  vat: number;
  serviceCharge: number;
  discount: number;
  receiptTotal: number;
};

type ApiResponse = {
  restaurantName?: string;
  items?: { name: string; quantity: number; unitPrice: number }[];
  vat?: number;
  serviceCharge?: number;
  discount?: number;
  receiptTotal?: number;
  error?: string;
};

/** Which capture route the host chose; both end up as base64. */
export type CaptureSource = 'camera' | 'library';

const mediaTypeFor = (uri: string): string => {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
};

/**
 * Opens the camera or photo library and returns the photo as base64.
 * Returns null when the host backs out, which is not an error.
 */
export async function captureReceipt(source: CaptureSource): Promise<{ base64: string; mediaType: string } | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      source === 'camera'
        ? 'AddaSplit needs camera access to scan a receipt.'
        : 'AddaSplit needs photo access to read a receipt.',
    );
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    base64: true,
    // Receipts are tall and detailed: keep resolution up but stay inside
    // the request size limit.
    quality: 0.7,
    allowsEditing: false,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled) return null;

  const asset = result.assets[0];
  if (!asset?.base64) throw new Error('That photo couldn’t be read. Try again.');

  return { base64: asset.base64, mediaType: asset.mimeType ?? mediaTypeFor(asset.uri) };
}

/**
 * Sends the photo to the server, which holds the API key. The host app never
 * sees it — anything bundled into a mobile app is readable by whoever has it.
 */
export async function scanReceipt(base64: string, mediaType: string): Promise<ScannedReceipt> {
  const endpoint = `${resolveGuestBaseURL()}/api/scan-receipt`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mediaType }),
    });
  } catch {
    throw new Error('Couldn’t reach the scanning service. Check your connection.');
  }

  const data = (await response.json().catch(() => ({}))) as ApiResponse;
  if (!response.ok) throw new Error(data.error || 'Couldn’t read that receipt.');

  const items = (data.items ?? [])
    .filter((item) => item.name?.trim())
    .map((item, index) => ({
      id: `scan-${Date.now()}-${index}`,
      name: item.name.trim(),
      quantity: Math.max(1, Math.round(item.quantity)),
      price: Math.max(0, Math.round(item.unitPrice)),
    }));

  if (items.length === 0) throw new Error('No items were found on that receipt.');

  return {
    restaurantName: data.restaurantName?.trim() || '',
    items,
    vat: Math.max(0, Math.round(data.vat ?? 0)),
    serviceCharge: Math.max(0, Math.round(data.serviceCharge ?? 0)),
    discount: Math.max(0, Math.round(data.discount ?? 0)),
    receiptTotal: Math.max(0, Math.round(data.receiptTotal ?? 0)),
  };
}
