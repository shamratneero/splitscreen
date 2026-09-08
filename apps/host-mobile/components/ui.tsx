import type { PropsWithChildren, ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { GlassSurface } from './glass-surface';
import { Icon, type IconName } from './icon';
import { useTheme } from './theme';
import { DEFAULT_CURRENCY, formatMoney } from '@splitsave/types';

/**
 * Formats an integer minor-unit amount in the given currency, defaulting to the
 * host's own. Kept named `taka` because that is what every caller reads as, but
 * it is no longer taka-only — the shared money module decides symbol, decimals
 * and whether digits group by lakh or by thousand.
 */
export const taka = (amount: number, currency: string = DEFAULT_CURRENCY) => formatMoney(amount, currency);
export function Page({ children, header, footer, tabs = false }: PropsWithChildren<{ header?: ReactNode; footer?: ReactNode; tabs?: boolean }>) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  return <View style={[ui.viewport, { backgroundColor: isDark ? '#0B120F' : '#EAF0EA' }]}>
    <View style={[ui.page, { backgroundColor: colors.canvas }]}>
      <View style={{ paddingTop: Math.max(insets.top, 12) }}>{header}</View>
      <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[ui.content, { paddingBottom: tabs && Platform.OS !== 'ios' ? 110 : 28 }]}>{children}</ScrollView>
      {footer && <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 20) }}>{footer}</View>}
    </View>
  </View>;
}
export function Heading({ title, subtitle, centered = false }: { title: string; subtitle?: string; centered?: boolean }) {
  const { colors } = useTheme();
  return <View style={{ gap: 10, marginBottom: 24 }}><Text accessibilityRole="header" style={[ui.title, { color: colors.ink, textAlign: centered ? 'center' : 'left' }]}>{title}</Text>{subtitle && <Text style={[ui.description, { color: colors.muted, textAlign: centered ? 'center' : 'left' }]}>{subtitle}</Text>}</View>;
}
export function Button({ title, onPress, icon, secondary = false, disabled = false }: { title: string; onPress: () => void; icon?: IconName; secondary?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  const foreground = secondary ? colors.ink : '#FFFFFF';
  const action = () => { if (Platform.OS === 'ios') void Haptics.selectionAsync().catch(() => {}); onPress(); };
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={action}
    style={({ pressed }) => [ui.button, { backgroundColor: secondary ? colors.input : '#096544', borderColor: secondary ? colors.line : '#39856A', transform: [{ scale: pressed ? .985 : 1 }] }, disabled && { backgroundColor: colors.line, borderColor: colors.line }]}>
    {icon && <Icon name={icon} color={foreground} size={20} />}<Text style={[ui.buttonText, { color: disabled ? colors.muted : foreground }]}>{title}</Text>
  </Pressable>;
}
export function RoundButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}><GlassSurface interactive style={ui.round}><Icon name={icon} color={colors.ink} size={20} /></GlassSurface></Pressable>;
}
export function Surface({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { colors } = useTheme();
  return <View style={[ui.surface, { backgroundColor: colors.surface, borderColor: colors.line }, style]}>{children}</View>;
}
export function Toolbar({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ReactNode }) {
  const { colors } = useTheme();
  return <View style={ui.toolbar}>{onBack ? <RoundButton icon="back" label="Go back" onPress={onBack} /> : <Text style={[ui.wordmark, { color: colors.ink }]}>SplitSave<Text style={{ color: colors.primary }}>.</Text></Text>}{title && <Text style={{ fontSize: 14, fontWeight: '600', color: colors.muted }}>{title}</Text>}{right ?? <View style={{ width: 44 }} />}</View>;
}
export const ui = StyleSheet.create({
  viewport: { flex: 1, alignItems: 'center' }, page: { flex: 1, width: '100%', maxWidth: 480 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 22 }, toolbar: { minHeight: 56, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontSize: 24, fontWeight: '800', letterSpacing: -.9 }, title: { fontSize: 30, lineHeight: 37, fontWeight: '700', letterSpacing: -.9 },
  description: { fontSize: 15, lineHeight: 23 }, round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 54, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600' }, surface: { borderWidth: 1, borderRadius: 18, padding: 16 },
  section: { fontSize: 15, fontWeight: '600', marginBottom: 12 }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
});
