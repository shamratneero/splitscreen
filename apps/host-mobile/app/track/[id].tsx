import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Page, Surface, Toolbar, taka, ui } from '../../components/ui';
import { RecordPayments } from '../../components/record-payments';
import { Icon } from '../../components/icon';
import { useTheme } from '../../components/theme';
import { confirmPayment, confirmPayments, fetchSplitTracking, recordedReferences, subscribeToSplit, type SplitTracking, type TrackedGuest } from '../../lib/split-tracking';

/** "2026-09-07" is a database value; hosts should read "7 Sep". */
const formatDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const STATUS_LABEL: Record<TrackedGuest['paymentStatus'], string> = {
  UNPAID: 'Pending',
  GUEST_REPORTED: 'Reported',
  CONFIRMED: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

export default function TrackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<SplitTracking | null>(null);
  const [tab, setTab] = useState<'people' | 'items'>('people');
  const [error, setError] = useState<string | null>(null);
  const [busyGuest, setBusyGuest] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchSplitTracking(String(id)));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [id]);

  /**
   * Claims arrive from other people's phones. Realtime carries them the moment
   * they land; the slow poll behind it covers a socket that dropped without
   * saying so, which a host watching a table fill up would otherwise never
   * notice.
   */
  useEffect(() => {
    load();
    const stop = subscribeToSplit(String(id), load);
    const timer = setInterval(load, 30000);
    return () => { stop(); clearInterval(timer); };
  }, [load, id]);

  const markPaid = async (guest: TrackedGuest) => {
    setBusyGuest(guest.id);
    try {
      await confirmPayment(guest.id, guest.total);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyGuest(null);
    }
  };

  if (error && !data)
    return (
      <Page header={<Toolbar title="Live tracking" onBack={() => router.back()} />}>
        <Surface style={{ padding: 16 }}>
          <Text style={{ color: colors.amber, fontSize: 13 }}>{error}</Text>
        </Surface>
      </Page>
    );

  if (!data)
    return (
      <Page header={<Toolbar title="Live tracking" onBack={() => router.back()} />}>
        <View style={{ paddingTop: 60, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Page>
    );

  const people = data.guests.length;
  const progress = people ? data.confirmedCount / people : 0;
  const collected = data.guests
    .filter((guest) => guest.paymentStatus === 'CONFIRMED')
    .reduce((sum, guest) => sum + guest.total, 0);

  return (
    <Page
      header={<Toolbar title={data.restaurantName} onBack={() => router.back()} right={
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh" onPress={load} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="receipt" size={18} color={colors.primary} />
        </Pressable>
      } />}
      footer={<Button title="Back to home" secondary onPress={() => router.replace('/')} />}
    >
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 14 }}>
        {formatDate(data.splitDate)} · {people} {people === 1 ? 'person' : 'people'}
      </Text>

      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.soft, overflow: 'hidden' }}>
        <View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: colors.primary }} />
      </View>
      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '600', marginTop: 8 }}>
        {data.confirmedCount} of {people} confirmed
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{taka(collected, data.currency)} received</Text>

      <View style={{ flexDirection: 'row', backgroundColor: colors.soft, borderRadius: 12, padding: 4, marginTop: 18 }}>
        {(['people', 'items'] as const).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={key === 'people' ? 'People' : 'Items'}
            onPress={() => setTab(key)}
            style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: tab === key ? colors.surface : 'transparent' }}
          >
            <Text style={{ color: tab === key ? colors.ink : colors.muted, fontWeight: '600', fontSize: 13 }}>
              {key === 'people' ? 'People' : 'Items'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={{ marginTop: 14 }}>
        {tab === 'people' ? (
          people === 0 ? (
            <Surface style={{ padding: 18 }}>
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }}>
                No one has claimed anything yet. Share the link to get started.
              </Text>
            </Surface>
          ) : (
            <Surface style={{ padding: 0, overflow: 'hidden' }}>
              {data.guests.map((guest, index) => (
                <View key={guest.id} style={{ padding: 14, borderTopWidth: index ? 1 : 0, borderColor: colors.line }}>
                  <View style={ui.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 15 }}>{guest.displayName}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                        {guest.itemCount} {guest.itemCount === 1 ? 'item' : 'items'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ color: colors.ink, fontWeight: '600' }}>{taka(guest.total, data.currency)}</Text>
                      <Text style={{ color: guest.paymentStatus === 'CONFIRMED' ? colors.primary : colors.amber, fontSize: 11, fontWeight: '600' }}>
                        {STATUS_LABEL[guest.paymentStatus]}
                      </Text>
                    </View>
                  </View>
                  {guest.paymentStatus !== 'CONFIRMED' && guest.total > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Mark ${guest.displayName} as paid`}
                      disabled={busyGuest === guest.id}
                      onPress={() => markPaid(guest)}
                      style={{ marginTop: 10, minHeight: 40, borderRadius: 10, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>
                        {busyGuest === guest.id ? 'Saving…' : 'Mark as received'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </Surface>
          )
        ) : (
          <Surface style={{ padding: 0, overflow: 'hidden' }}>
            {data.items.map((item, index) => (
              <View key={item.id} style={{ padding: 14, borderTopWidth: index ? 1 : 0, borderColor: colors.line }}>
                <View style={ui.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 15 }}>{item.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                      {item.claimedQuantity} of {item.quantity} claimed
                      {item.claimedBy.length ? ` · ${[...new Set(item.claimedBy)].join(', ')}` : ''}
                    </Text>
                  </View>
                  <Text style={{ color: colors.ink, fontWeight: '600' }}>{taka(item.unitPrice * item.quantity, data.currency)}</Text>
                </View>
              </View>
            ))}
          </Surface>
        )}

        {/* Settling several guests at once from pasted confirmations — the
            host's real chore is cross-checking amounts in another app. */}
        {data.guests.some(guest => guest.paymentStatus !== 'CONFIRMED' && guest.total > 0) ? (
          <RecordPayments
            expected={data.guests.map(guest => ({
              guestId: guest.id,
              displayName: guest.displayName,
              amount: guest.total,
              settled: guest.paymentStatus === 'CONFIRMED',
            }))}
            currency={data.currency}
            alreadySeen={recordedReferences(data)}
            busy={busyGuest === 'batch'}
            onConfirm={async entries => {
              setBusyGuest('batch');
              try {
                await confirmPayments(entries);
                await load();
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : String(cause));
              } finally {
                setBusyGuest(null);
              }
            }}
          />
        ) : null}

        {data.unclaimed.length ? (
          <View style={{ backgroundColor: colors.soft, borderRadius: 16, padding: 14, marginTop: 14 }}>
            <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 13, marginBottom: 8 }}>Unclaimed items</Text>
            {data.unclaimed.map((entry) => (
              <View key={entry.name} style={[ui.row, { marginTop: 4 }]}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>{entry.name} ×{entry.quantity}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>{taka(entry.value, data.currency)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {error ? <Text style={{ color: colors.amber, fontSize: 12, marginTop: 12 }}>{error}</Text> : null}
        <View style={{ height: 24 }} />
      </ScrollView>
    </Page>
  );
}
