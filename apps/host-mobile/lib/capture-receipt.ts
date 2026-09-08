import * as ImagePicker from 'expo-image-picker';
export type CaptureSource = 'camera' | 'library';
export async function captureReceipt(source: CaptureSource): Promise<{ base64: string; mediaType: string } | null> {
  const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photo access to scan a receipt.');
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.9 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset?.base64) throw new Error('That photo couldn’t be read. Try another image.');
  return { base64: asset.base64, mediaType: asset.mimeType ?? 'image/jpeg' };
}
