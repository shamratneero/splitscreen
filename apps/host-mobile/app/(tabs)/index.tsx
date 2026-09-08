import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Heading, Page, Toolbar, taka, ui } from '../../components/ui';
import { GlassSurface } from '../../components/glass-surface';
import { Icon } from '../../components/icon';
import { useTheme } from '../../components/theme';
import { useDraft } from '../../state/draft';
import { captureReceipt, scanReceipt, type CaptureSource } from '../../lib/scan-receipt';
import { fetchSplitHistory, outstandingTotal, type SplitSummary } from '../../lib/split-history';
import { useAuth } from '../../state/auth';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { update } = useDraft();
  const { profile } = useAuth();
  const currency = profile?.defaultCurrency ?? 'BDT';
  const [splits, setSplits] = useState<SplitSummary[] | null>(null);
  const [capture, setCapture] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scanController = useRef<AbortController | null>(null);
  useEffect(() => () => scanController.current?.abort(), []);

  // Re-read on every visit: a split published seconds ago should already be here.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchSplitHistory()
        .then(rows => { if (active) setSplits(rows); })
        .catch(() => { if (active) setSplits([]); });
      return () => { active = false; };
    }, []),
  );
  const [scanProgress, setScanProgress] = useState('Loading the scanner…');
  const [scanError, setScanError] = useState<string | null>(null);
  const start = () => { setCapture(false); update({ started: true, scanText: undefined, scanWarnings: undefined, scanReviewed: true }); router.push('/review'); };

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
      setScanProgress('Loading the scanner…');
      const controller = new AbortController();
      scanController.current = controller;
      const receipt = await scanReceipt(photo.base64, photo.mediaType, setScanProgress, controller.signal);
      if (controller.signal.aborted) return;
      update({
        started: true,
        scanText: receipt.rawText,
        scanWarnings: receipt.warnings,
        scanReviewed: false,
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
  const owed = outstandingTotal(splits ?? []);
  const openSplits = (splits ?? []).filter(split => !split.settled);
  // A first-time host sees the pitch; someone owed money sees the money.
  const hasHistory = (splits ?? []).length > 0;

  return <Page tabs header={<Toolbar />}>
    <ScrollView contentContainerStyle={hasHistory ? { paddingBottom: 28 } : { flexGrow: 1, justifyContent: 'center', paddingBottom: 36 }}>
      {owed > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`You are owed ${taka(owed, currency)} across ${openSplits.length} open splits`}
          onPress={() => router.push('/splits')}
          style={{ backgroundColor: colors.soft, borderRadius: 20, padding: 18, marginBottom: 22 }}
        >
          <View style={ui.row}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>You’re owed</Text>
              <Text style={{ color: colors.ink, fontSize: 30, fontWeight: '700', letterSpacing: -0.6 }}>{taka(owed, currency)}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                across {openSplits.length} open {openSplits.length === 1 ? 'split' : 'splits'}
              </Text>
            </View>
            <Icon name="arrow" size={18} color={colors.primary} />
          </View>
        </Pressable>
      ) : null}

      {!hasHistory ? (
        <>
          <View style={{ alignSelf: 'center', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 20, backgroundColor: colors.soft, marginBottom: 28 }}><Icon name="receipt" size={32} color={colors.primary} /></View>
          <View style={{ alignSelf: 'center', maxWidth: 285 }}><Heading centered title="Split bills, not friendships." subtitle="Add the bill. Share a link. Everyone pays their share." /></View>
        </>
      ) : null}

      <View style={{ gap: 10, marginTop: 12 }}><Button title="Scan receipt" icon="camera" onPress={() => setCapture(true)} /><Button title="Enter manually" secondary onPress={start} /></View>

      {hasHistory ? (
        <View style={{ marginTop: 28 }}>
          <Text style={[ui.section, { color: colors.ink, marginBottom: 8 }]}>Recent</Text>
          {(splits ?? []).slice(0, 4).map(split => (
            <Pressable
              key={split.id}
              accessibilityRole="button"
              accessibilityLabel={`${split.restaurantName}, ${split.paidCount} of ${split.guestCount} paid`}
              onPress={() => router.push(`/track/${split.id}`)}
              style={[ui.row, { paddingVertical: 13, gap: 12, borderTopWidth: 1, borderColor: colors.line }]}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 15 }}>{split.restaurantName}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {split.guestCount ? `${split.paidCount}/${split.guestCount} paid` : 'no claims yet'}
                </Text>
              </View>
              <Text style={{ color: split.settled ? colors.primary : colors.ink, fontWeight: '600' }}>
                {taka(split.receiptTotal, currency)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={{ textAlign: 'center', fontSize: 12, color: colors.muted, marginTop: 20 }}>Your friends join in their browser.</Text>
      )}
    </ScrollView>
    <Modal visible={capture} transparent animationType="slide" onRequestClose={() => { scanController.current?.abort(); setCapture(false); }}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,30,20,.35)' }}>
        <GlassSurface accessibilityViewIsModal style={{ padding: 28, paddingBottom: 40, gap: 16, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
          <View style={ui.row}><Text style={[ui.section, { color: colors.ink }]}>Scan a receipt</Text><Pressable accessibilityRole="button" onPress={() => { scanController.current?.abort(); setCapture(false); setScanError(null); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary }}>{scanning ? 'Cancel' : 'Dismiss'}</Text></Pressable></View>
          {scanning ? (
            <View style={{ paddingVertical: 22, alignItems: 'center', gap: 12 }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.muted, fontSize: 13 }} accessibilityLiveRegion="polite">{scanProgress}</Text>
            </View>
          ) : (
            <>
              <Text style={[ui.description, { color: colors.muted }]}>Photograph the whole bill, flat and well lit. Scanning stays on this device. You’ll review the result before sharing.</Text>
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
