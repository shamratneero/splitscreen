import { Pressable, Text, View } from 'react-native';
import { Heading, Page, Surface, Toolbar, ui } from '../../components/ui';
import { Icon } from '../../components/icon';
import { useTheme, type AppearanceChoice } from '../../components/theme';

export default function ProfileScreen() {
  const { colors, appearance, setAppearance } = useTheme();
  return <Page tabs header={<Toolbar />}><Heading title="Make it yours" subtitle="Small preferences. A familiar feeling." />
    <Surface style={{ gap: 18 }}><View style={ui.row}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}><Icon name="moon" color={colors.primary} /><Text style={{ color: colors.ink, fontWeight: '600' }}>Appearance</Text></View></View>
      <View style={{ flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: colors.input }}>
        {(['system', 'light', 'dark'] as AppearanceChoice[]).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: appearance === value }} onPress={() => setAppearance(value)} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: value === appearance ? colors.surface : 'transparent' }}><Text style={{ fontSize: 13, color: colors.ink, fontWeight: value === appearance ? '600' : '400' }}>{value[0].toUpperCase() + value.slice(1)}</Text></Pressable>)}
      </View>
    </Surface>
    <View style={{ marginTop: 28, gap: 12 }}><Text style={[ui.section, { color: colors.ink }]}>Host account</Text><Text style={[ui.description, { color: colors.muted }]}>Sign-in and payment details aren’t connected yet. Drafts in this preview last until you reload.</Text></View>
    <View style={{ flex: 1, justifyContent: 'flex-end', paddingTop: 48, gap: 6 }}><Text style={{ textAlign: 'center', color: colors.primary, fontSize: 17, fontWeight: '700' }}>Good food. Fair splits.</Text><Text style={{ textAlign: 'center', color: colors.muted, fontSize: 12 }}>Made for the way we adda.</Text></View>
  </Page>;
}
