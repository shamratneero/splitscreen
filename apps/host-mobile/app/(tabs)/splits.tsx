import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Button, Heading, Page, Surface, Toolbar, taka, ui } from '../../components/ui';
import { Icon } from '../../components/icon';
import { useTheme } from '../../components/theme';
import { useDraft } from '../../state/draft';

export default function SplitsScreen() {
  const { colors } = useTheme();
  const { draft, update } = useDraft();
  const router = useRouter();
  return <Page tabs header={<Toolbar />}><Heading title="Your splits" subtitle="A little less keeping track." />
    {draft.started ? <Surface><Pressable accessibilityRole="button" accessibilityLabel="Continue draft" onPress={() => router.push('/review')} style={ui.row}>
      <View style={{ backgroundColor: colors.soft, padding: 12, borderRadius: 16 }}><Icon name="receipt" /></View>
      <View style={{ flex: 1, gap: 5 }}><Text style={{ color: colors.ink, fontWeight: '600', fontSize: 16 }}>{draft.restaurant || 'New split'}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Draft · {draft.items.length} items</Text></View>
      <Text style={{ color: colors.ink, fontWeight: '600' }}>{taka(draft.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}</Text><Icon name="arrow" size={16} color={colors.muted} />
    </Pressable></Surface> : <View style={{ flex: 1, justifyContent: 'center', gap: 20, paddingBottom: 80 }}><View style={{ alignSelf: 'center', padding: 20, borderRadius: 24, backgroundColor: colors.soft }}><Icon name="receipt" size={32} /></View><Heading centered title="A fresh start" subtitle="Your bills will feel right at home here. Start with your first split." /><Button title="Create a split" icon="plus" onPress={() => { update({ started: true }); router.push('/review'); }} /></View>}
  </Page>;
}
