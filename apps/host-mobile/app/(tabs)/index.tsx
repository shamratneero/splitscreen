import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Heading, Page, RoundButton, Surface, Toolbar, ui } from '../../components/ui';
import { GlassSurface } from '../../components/glass-surface';
import { ReceiptArt } from '../../components/receipt-art';
import { Icon } from '../../components/icon';
import { useTheme } from '../../components/theme';
import { useDraft } from '../../state/draft';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { update } = useDraft();
  const [capture, setCapture] = useState(false);
  const start = () => { setCapture(false); update({ started: true }); router.push('/review'); };
  return <Page tabs header={<Toolbar right={<RoundButton icon="settings" label="Open profile" onPress={() => router.push('/profile')} />} />}>
    <View style={{ flex: 1, justifyContent: 'center', paddingTop: 10, paddingBottom: 36 }}>
      <View style={{ alignItems: 'center', marginBottom: 26 }}><ReceiptArt /></View>
      <View style={{ alignSelf: 'center', maxWidth: 285 }}><Heading centered title="Split bills, not friendships." subtitle="Scan a receipt, let everyone claim what they ordered, and settle up." /></View>
      <View style={{ gap: 10, marginTop: 12 }}><Button title="Scan receipt" icon="camera" onPress={() => setCapture(true)} /><Button title="Enter manually" secondary onPress={start} /></View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 23 }}><Icon name="people" color={colors.muted} size={16} /><Text style={{ fontSize: 12, color: colors.muted }}>Just one app. Everyone’s invited.</Text></View>
    </View>
    <Modal visible={capture} transparent animationType="slide" onRequestClose={() => setCapture(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,30,20,.35)' }}>
        <GlassSurface accessibilityViewIsModal style={{ padding: 28, paddingBottom: 40, gap: 16, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
          <View style={ui.row}><Text style={[ui.section, { color: colors.ink }]}>Receipt scanning</Text><Pressable accessibilityRole="button" onPress={() => setCapture(false)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary }}>Dismiss</Text></Pressable></View>
          <Text style={[ui.description, { color: colors.muted }]}>Camera scanning isn’t available yet. You can still enter your bill by hand.</Text><Button title="Enter manually" onPress={start} />
        </GlassSurface>
      </View>
    </Modal>
  </Page>;
}
