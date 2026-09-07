import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Heading, Page, Toolbar, ui } from '../../components/ui';
import { GlassSurface } from '../../components/glass-surface';
import { Icon } from '../../components/icon';
import { useTheme } from '../../components/theme';
import { useDraft } from '../../state/draft';
import { captureReceipt, scanReceipt, type CaptureSource } from '../../lib/scan-receipt';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { update } = useDraft();
  const [capture, setCapture] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const start = () => { setCapture(false); update({ started: true }); router.push('/review'); };

  /**
   * Scanning fills the draft and drops the host on the review screen, where
   * they correct whatever the model misread. OCR on a creased receipt is never
   * perfect, so the edit step is part of the flow, not a fallback.
   */
  const scan = async (source: CaptureSource) => {
    setScanError(null);
    try {
      const photo = await captureReceipt(source);
      if (!photo) return;
      setScanning(true);
      const receipt = await scanReceipt(photo.base64, photo.mediaType);
      update({
        started: true,
        restaurant: receipt.restaurantName,
        items: receipt.items,
        vat: String(receipt.vat),
        service: String(receipt.serviceCharge),
        discount: String(receipt.discount),
        receiptTotal: String(receipt.receiptTotal),
      });
      setCapture(false);
      router.push('/review');
    } catch (cause) {
      setScanError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setScanning(false);
    }
  };
  return <Page tabs header={<Toolbar />}>
    <View style={{ flex: 1, justifyContent: 'center', paddingTop: 10, paddingBottom: 36 }}>
      <View style={{ alignSelf: 'center', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 20, backgroundColor: colors.soft, marginBottom: 28 }}><Icon name="receipt" size={32} color={colors.primary} /></View>
      <View style={{ alignSelf: 'center', maxWidth: 285 }}><Heading centered title="Split bills, not friendships." subtitle="Add the bill. Share a link. Everyone pays their share." /></View>
      <View style={{ gap: 10, marginTop: 12 }}><Button title="Scan receipt" icon="camera" onPress={() => setCapture(true)} /><Button title="Enter manually" secondary onPress={start} /></View>
      <Text style={{ textAlign: 'center', fontSize: 12, color: colors.muted, marginTop: 20 }}>Your friends join in their browser.</Text>
    </View>
    <Modal visible={capture} transparent animationType="slide" onRequestClose={() => setCapture(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,30,20,.35)' }}>
        <GlassSurface accessibilityViewIsModal style={{ padding: 28, paddingBottom: 40, gap: 16, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
          <View style={ui.row}><Text style={[ui.section, { color: colors.ink }]}>Scan a receipt</Text><Pressable accessibilityRole="button" disabled={scanning} onPress={() => { setCapture(false); setScanError(null); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary }}>Dismiss</Text></Pressable></View>
          {scanning ? (
            <View style={{ paddingVertical: 22, alignItems: 'center', gap: 12 }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.muted, fontSize: 13 }}>Reading your receipt…</Text>
            </View>
          ) : (
            <>
              <Text style={[ui.description, { color: colors.muted }]}>Photograph the whole bill, flat and well lit. You can fix anything it misreads on the next screen.</Text>
              <Button title="Take a photo" icon="camera" onPress={() => scan('camera')} />
              <Button title="Choose from library" secondary onPress={() => scan('library')} />
              {scanError ? <Text accessibilityLiveRegion="polite" style={{ color: colors.amber, fontSize: 13, lineHeight: 19 }}>{scanError}</Text> : null}
              <Pressable accessibilityRole="button" onPress={start} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '600' }}>Enter manually instead</Text></Pressable>
            </>
          )}
        </GlassSurface>
      </View>
    </Modal>
  </Page>;
}
