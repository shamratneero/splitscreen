import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Button, Heading, Page, Surface, Toolbar, taka, ui } from '../../components/ui';
import { Icon } from '../../components/icon';
import { useTheme } from '../../components/theme';
import { useDraft } from '../../state/draft';
import { fetchSplitHistory, type SplitSummary } from '../../lib/split-history';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
};

export default function SplitsScreen() {
  const { colors } = useTheme();
  const { draft, update } = useDraft();
  const router = useRouter();
  const [splits, setSplits] = useState<SplitSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setSplits(await fetchSplitHistory());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  // Re-read on every visit so a split published moments ago is already here.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = splits?.filter((split) => !split.settled) ?? [];
  const settled = splits?.filter((split) => split.settled) ?? [];

  const row = (split: SplitSummary) => (
    <Pressable
      key={split.id}
      accessibilityRole="button"
      accessibilityLabel={`${split.restaurantName}, ${split.paidCount} of ${split.guestCount} paid`}
      onPress={() => router.push(`/track/${split.id}`)}
      style={[ui.row, { paddingVertical: 14, gap: 12 }]}
    >
      <View style={{ backgroundColor: colors.soft, padding: 12, borderRadius: 16 }}>
        <Icon name={split.settled ? 'check' : 'receipt'} color={split.settled ? colors.primary : undefined} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 15 }}>{split.restaurantName}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {formatDate(split.splitDate)}
          {split.guestCount ? ` · ${split.paidCount}/${split.guestCount} paid` : ' · no claims yet'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Text style={{ color: colors.ink, fontWeight: '600' }}>{taka(split.receiptTotal)}</Text>
        {split.settled ? (
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>Settled</Text>
        ) : split.owed > split.collected ? (
          <Text style={{ color: colors.amber, fontSize: 11, fontWeight: '600' }}>
            {taka(split.owed - split.collected)} due
          </Text>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <Page tabs header={<Toolbar />}>
      <Heading title="Your splits" subtitle="A little less keeping track." />

      {splits === null && !error ? (
        <View style={{ paddingTop: 40, alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.primary}
            />
          }
        >
          {draft.started ? (
            <Surface style={{ marginBottom: 18 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Continue draft" onPress={() => router.push('/review')} style={ui.row}>
                <View style={{ backgroundColor: colors.soft, padding: 12, borderRadius: 16 }}>
                  <Icon name="receipt" />
                </View>
                <View style={{ flex: 1, gap: 5, marginLeft: 12 }}>
                  <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 16 }}>{draft.restaurant || 'New split'}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Draft · {draft.items.length} items</Text>
                </View>
                <Text style={{ color: colors.ink, fontWeight: '600' }}>
                  {taka(draft.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}
                </Text>
                <Icon name="arrow" size={16} color={colors.muted} />
              </Pressable>
            </Surface>
          ) : null}

          {error ? (
            <Surface style={{ padding: 14 }}>
              <Text style={{ color: colors.amber, fontSize: 13 }}>{error}</Text>
            </Surface>
          ) : null}

          {open.length ? (
            <>
              <Text style={[ui.section, { color: colors.ink, marginBottom: 8 }]}>Open</Text>
              <Surface style={{ padding: 0, paddingHorizontal: 14 }}>{open.map(row)}</Surface>
            </>
          ) : null}

          {settled.length ? (
            <>
              <Text style={[ui.section, { color: colors.ink, marginTop: 24, marginBottom: 8 }]}>Settled</Text>
              <Surface style={{ padding: 0, paddingHorizontal: 14 }}>{settled.map(row)}</Surface>
            </>
          ) : null}

          {!open.length && !settled.length && !draft.started && !error ? (
            <View style={{ paddingTop: 40, gap: 20 }}>
              <View style={{ alignSelf: 'center', padding: 20, borderRadius: 24, backgroundColor: colors.soft }}>
                <Icon name="receipt" size={32} />
              </View>
              <Heading centered title="A fresh start" subtitle="Your bills will feel right at home here. Start with your first split." />
              <Button title="Create a split" icon="plus" onPress={() => { update({ started: true }); router.push('/review'); }} />
            </View>
          ) : null}

          <View style={{ height: 28 }} />
        </ScrollView>
      )}
    </Page>
  );
}
