import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { calculateSplit } from '@splitpay/split-engine';
import { Button, Heading, Page, Surface, Toolbar, taka, ui } from '../components/ui';
import { Icon } from '../components/icon';
import { useTheme } from '../components/theme';
import { useDraft, type DraftItem } from '../state/draft';

const money = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
export default function ReviewScreen() {
  const [showScanText, setShowScanText] = useState(false);
  const { colors } = useTheme();
  const { draft, update } = useDraft();
  const router = useRouter();
  const subtotal = draft.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const result = useMemo(() => {
    const values = [draft.vat, draft.service, draft.discount, draft.receiptTotal].map(money);
    if (values.some(value => value === null) || !draft.items.length || !draft.restaurant.trim() || draft.items.some(item => !item.name.trim() || item.quantity < 1 || !Number.isSafeInteger(item.quantity) || !Number.isSafeInteger(item.price))) return null;
    const [vat, serviceCharge, discount, receiptTotal] = values as number[];
    if (discount > subtotal) return null;
    try { return calculateSplit({ items: draft.items.map(item => ({ ...item, unitPrice: item.price })), claims: [], guests: [], vat, serviceCharge, discount, receiptTotal }); } catch { return null; }
  }, [draft, subtotal]);
  const edit = (id: string, patch: Partial<DraftItem>) => update({ items: draft.items.map(item => item.id === id ? { ...item, ...patch } : item) });
  const inputStyle = { color: colors.ink, backgroundColor: colors.input, borderRadius: 10, minHeight: 44, paddingHorizontal: 12, fontSize: 15 };

  return <Page header={<Toolbar onBack={() => router.back()} title="New split" />} footer={<Button title="Create split" onPress={() => router.push('/share')} disabled={!result?.reconciled || (Boolean(draft.scanText) && !draft.scanReviewed)} />}>
    <Heading title="Enter the bill" subtitle="Check the items and total before sharing." />
    {draft.scanText ? <Surface style={{ marginBottom: 20, gap: 10 }}>
      <Text style={{ color: colors.ink, fontWeight: '600' }}>Review the scan</Text>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>Check every item, quantity and amount against your receipt.</Text>
      {draft.scanWarnings?.map((warning, index) => <Text key={index} style={{ color: colors.amber, fontSize: 13, lineHeight: 19 }}>{warning}</Text>)}
      <Pressable accessibilityRole="button" onPress={() => setShowScanText(!showScanText)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary }}>{showScanText ? 'Hide extracted text' : 'Show extracted text'}</Text></Pressable>
      {showScanText ? <Text selectable style={{ color: colors.muted, fontSize: 12, lineHeight: 19 }}>{draft.scanText}</Text> : null}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(draft.scanReviewed) }} accessibilityLabel="I checked the scan against my receipt" onPress={() => update({ scanReviewed: !draft.scanReviewed })} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ color: colors.primary, fontSize: 20 }}>{draft.scanReviewed ? '☑' : '☐'}</Text><Text style={{ color: colors.ink, fontSize: 13, flex: 1 }}>I checked the scan against my receipt</Text>
      </Pressable>
    </Surface> : null}
    <Surface style={{ marginBottom: 26 }}><Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8 }}>Restaurant</Text><TextInput accessibilityLabel="Restaurant name" placeholder="Restaurant name" placeholderTextColor={colors.muted} style={[inputStyle, { fontWeight: '600' }]} value={draft.restaurant} onChangeText={restaurant => update({ restaurant })} /></Surface>
    <View style={[ui.row, { marginBottom: 12 }]}><Text style={[ui.section, { color: colors.ink, marginBottom: 0 }]}>Items</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Quantity × unit price</Text></View>
    <Surface style={{ padding: 0, overflow: 'hidden' }}>
      {draft.items.map((item, index) => <View key={item.id} style={{ padding: 14, gap: 10, borderTopWidth: index ? 1 : 0, borderColor: colors.line }}>
        <View style={ui.row}><TextInput accessibilityLabel={`Item ${index + 1} name`} placeholder="Item name" placeholderTextColor={colors.muted} value={item.name} onChangeText={name => edit(item.id, { name })} style={{ flex: 1, color: colors.ink, fontSize: 15, minHeight: 44 }} /><Text style={{ fontWeight: '600', color: colors.ink }}>{taka(item.price * item.quantity)}</Text></View>
        <View style={ui.row}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><TextInput accessibilityLabel={`Item ${index + 1} quantity`} keyboardType="number-pad" value={String(item.quantity)} onChangeText={value => edit(item.id, { quantity: Number(value.replace(/\D/g, '')) })} style={[inputStyle, { width: 48, textAlign: 'center', paddingHorizontal: 4 }]} /><Text style={{ color: colors.muted }}>× ৳</Text><TextInput accessibilityLabel={`Item ${index + 1} unit price`} keyboardType="number-pad" value={String(item.price)} onChangeText={value => edit(item.id, { price: Number(value.replace(/\D/g, '')) })} style={[inputStyle, { width: 80, textAlign: 'right' }]} /></View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove item ${index + 1}`} onPress={() => update({ items: draft.items.filter(entry => entry.id !== item.id) })} style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 10 }}><Text style={{ color: colors.muted, fontSize: 12 }}>Remove</Text></Pressable>
        </View>
      </View>)}
      <Pressable accessibilityRole="button" onPress={() => update({ items: [...draft.items, { id: String(Date.now()), name: '', quantity: 1, price: 0 }] })} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderTopWidth: 1, borderColor: colors.line }}><Icon name="plus" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '600' }}>Add item</Text></Pressable>
    </Surface>
    <View style={{ marginTop: 26 }}><Text style={[ui.section, { color: colors.ink }]}>Charges <Text style={{ fontSize: 12, fontWeight: '400', color: colors.muted }}>· shared automatically</Text></Text>
      <Surface style={{ gap: 10 }}><View style={[ui.row, { minHeight: 32 }]}><Text style={{ color: colors.muted }}>Subtotal</Text><Text style={{ color: colors.ink }}>{taka(subtotal)}</Text></View>
        {([{ key: 'vat', label: 'VAT' }, { key: 'service', label: 'Service charge' }, { key: 'discount', label: 'Discount' }] as const).map(({ key, label }) => <View key={key} style={ui.row}><Text style={{ color: colors.muted }}>{label}</Text><TextInput accessibilityLabel={label} keyboardType="number-pad" value={draft[key]} onChangeText={value => update({ [key]: value.replace(/\D/g, '') })} style={[inputStyle, { width: 96, textAlign: 'right' }]} /></View>)}
        <View style={[ui.row, { borderTopWidth: 1, borderColor: colors.line, paddingTop: 12 }]}><Text style={{ color: colors.ink, fontWeight: '600' }}>Receipt total</Text><TextInput accessibilityLabel="Receipt total" keyboardType="number-pad" value={draft.receiptTotal} onChangeText={value => update({ receiptTotal: value.replace(/\D/g, '') })} style={[inputStyle, { width: 96, textAlign: 'right', fontWeight: '600' }]} /></View>
      </Surface>
    </View>
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, backgroundColor: colors.soft, padding: 14, marginTop: 16 }}><Icon name={result?.reconciled ? 'check' : 'receipt'} size={18} color={result?.reconciled ? colors.primary : colors.amber} /><Text style={{ color: result?.reconciled ? colors.primary : colors.amber, fontSize: 12, flex: 1 }}>{result?.reconciled ? 'Total matches receipt' : result ? `Check the total · difference ${taka(Math.abs(result.calculatedTotal - result.receiptTotal))}` : 'Check item names, quantities, and amounts'}</Text>{result?.reconciled && <Text style={{ color: colors.primary, fontWeight: '700' }}>{taka(result.calculatedTotal)}</Text>}</View>
  </Page>;
}
