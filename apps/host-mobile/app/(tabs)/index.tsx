import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Page, Surface, Toolbar, editorialFont, taka, ui } from '../../components/ui';
import { GlassSurface } from '../../components/glass-surface';
import { Icon } from '../../components/icon';
import { useTheme } from '../../components/theme';
import { useDraft } from '../../state/draft';
import { captureReceipt, scanningAvailable, scanReceipt, type CaptureSource } from '../../lib/scan-receipt';
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
    <View style={{ paddingBottom: 24 }}>
      <View style={{ marginBottom: 28 }}>
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>YOUR TABLE, SORTED</Text>
        <Text accessibilityRole="header" style={{ fontFamily: editorialFont, fontSize: hasHistory ? 36 : 40, lineHeight: hasHistory ? 43 : 46, letterSpacing: -1.3, color: colors.ink }}>
          {hasHistory ? `Hey, ${profile?.displayName?.trim().split(' ')[0] || 'there'}.` : 'Split bills,\nnot friendships.'}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 12, maxWidth: 340 }}>
          {hasHistory ? 'Here’s where your table stands.' : 'Good company. One receipt. Everyone takes care of their share.'}
        </Text>
      </View>

      {hasHistory ? <Pressable
        accessibilityRole="button"
        accessibilityLabel={`You are owed ${taka(owed, currency)} across ${openSplits.length} open splits`}
        onPress={() => router.push('/splits')}
        style={{ backgroundColor: '#245C45', borderRadius: 18, padding: 24, marginBottom: 24 }}>
        <View style={ui.row}>
          <Text style={{ color: '#D6E6D8', fontSize: 13 }}>Still to come in</Text>
          <Icon name="arrow" size={18} color="#D6E6D8" />
        </View>
        <Text style={{ color: '#FFFFFF', fontSize: 42, lineHeight: 54, letterSpacing: -1.6, fontWeight: '500', marginTop: 8, fontVariant: ['tabular-nums'] }}>{taka(owed, currency)}</Text>
        <View style={{ borderTopWidth: 1, borderColor: '#527A62', paddingTop: 14, marginTop: 16 }}><Text style={{ color: '#D6E6D8', fontSize: 12 }}>{openSplits.length ? `${openSplits.length} open ${openSplits.length === 1 ? 'split' : 'splits'} · View your bills` : 'Everything collected. Nice and tidy.'}</Text></View>
      </Pressable> : null}

      <Surface style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 2 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name="receipt" size={23} color={colors.primary} /></View>
          <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontSize: 16, fontWeight: '600' }}>Start a new split</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{scanningAvailable ? 'A photo of the bill is all you need.' : 'Add the items and share a link.'}</Text></View>
        </View>
        {/* A packaged build has no WebAssembly scanner, so offering a camera
            that fails after the photo is taken would be worse than not
            offering it. */}
        {scanningAvailable ? (
          <>
            <Button title="Scan receipt" icon="camera" onPress={() => setCapture(true)} />
            <Button title="Enter manually" secondary onPress={start} />
          </>
        ) : (
          <Button title="Enter the bill" icon="plus" onPress={start} />
        )}
      </Surface>

      {hasHistory ? <View style={{ marginTop: 28 }}>
        <View style={[ui.row, { marginBottom: 8 }]}>
          <Text style={[ui.section, { color: colors.ink, marginBottom: 0 }]}>Recent splits</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/splits')} style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 12 }}><Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>View all</Text></Pressable>
        </View>
        {(splits ?? []).slice(0, 4).map(split => <Pressable key={split.id} accessibilityRole="button"
          accessibilityLabel={`${split.restaurantName}, ${split.paidCount} of ${split.guestCount} paid`}
          onPress={() => router.push(`/track/${split.id}`)}
          style={[ui.row, { paddingVertical: 17, borderTopWidth: 1, borderColor: colors.line }]}>
          <View style={{ width: 38, height: 42, borderWidth: 1, borderColor: colors.line, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}><Icon name="receipt" color={colors.muted} size={19} /></View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 15 }}>{split.restaurantName}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{split.guestCount ? `${split.paidCount} of ${split.guestCount} paid` : 'Waiting for the first claim'}</Text>
          </View>
          <Text style={{ color: split.settled ? colors.primary : colors.ink, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{taka(split.receiptTotal, currency)}</Text>
        </Pressable>)}
      </View> : <View style={{ marginTop: 30 }}>
        <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1.5, marginBottom: 18 }}>FROM BILL TO ALL SETTLED</Text>
        {[
          { title: 'Add the bill', detail: 'Scan a receipt or enter the items.' },
          { title: 'Invite the table', detail: 'Friends choose their items from your link.' },
          { title: 'See it settle', detail: 'Keep track as everyone pays you back.' },
        ].map((step, index) => <View key={step.title} style={{ flexDirection: 'row', gap: 16, paddingBottom: 20 }}>
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600', paddingTop: 2, fontVariant: ['tabular-nums'] }}>0{index + 1}</Text>
          <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.ink, fontWeight: '500', fontSize: 14 }}>{step.title}</Text><Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19 }}>{step.detail}</Text></View>
        </View>)}
      </View>}
    </View>
    <Modal visible={capture} transparent animationType="slide" onRequestClose={() => { scanController.current?.abort(); setCapture(false); }}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,30,20,.35)' }}>
        <GlassSurface accessibilityViewIsModal style={{ padding: 28, paddingBottom: 40, gap: 16, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
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
