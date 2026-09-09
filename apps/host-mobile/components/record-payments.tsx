import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { parseTransfers, reconcile, suggestFor, type ExpectedPayment } from '@splitup/payment-matcher';
import { Surface, taka, ui } from './ui';
import { useTheme } from './theme';

/**
 * Settling several guests from pasted bKash/Nagad confirmations.
 *
 * The host's real chore is not confirming one payment — it is cross-checking
 * five incoming amounts against five expected ones in another app. Pasting the
 * messages does that comparison for them.
 *
 * Nothing is applied silently. Confident matches are listed for approval, and
 * anything the matcher will not commit to — two guests owing the same amount,
 * an amount nobody owes — is shown as a question rather than a guess, because
 * crediting the wrong guest costs someone real money.
 */
export function RecordPayments({
  expected,
  currency,
  alreadySeen,
  busy,
  onConfirm,
}: {
  expected: ExpectedPayment[];
  currency: string;
  alreadySeen: string[];
  busy: boolean;
  onConfirm: (entries: { guestId: string; amount: number; reference: string | null }[]) => void;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState<Record<string, string>>({});

  const result = useMemo(() => {
    if (!text.trim()) return null;
    return reconcile(parseTransfers(text), expected, { alreadySeen, tolerance: 0 });
  }, [text, expected, alreadySeen]);

  // A transfer the host attached by hand counts alongside the automatic ones.
  const manual = useMemo(() => {
    if (!result) return [];
    const pool = [...result.ambiguous.map(a => a.transfer), ...result.unmatched];
    return pool.flatMap(transfer => {
      const guestId = resolved[transfer.source];
      if (!guestId) return [];
      const guest = expected.find(entry => entry.guestId === guestId);
      return guest ? [{ transfer, guestId, displayName: guest.displayName }] : [];
    });
  }, [result, resolved, expected]);

  const toApply = result
    ? [
        ...result.matched.map(m => ({ guestId: m.guestId, amount: m.transfer.amount, reference: m.transfer.reference })),
        ...manual.map(m => ({ guestId: m.guestId, amount: m.transfer.amount, reference: m.transfer.reference })),
      ]
    : [];

  const { colors } = useTheme();
  const input = {
    color: colors.ink,
    backgroundColor: colors.input,
    borderRadius: 12,
    minHeight: 96,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top' as const,
  };

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Record payments from bKash or Nagad messages"
        onPress={() => setOpen(true)}
        style={{ marginTop: 14, minHeight: 48, borderRadius: 14, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>Record payments from messages</Text>
      </Pressable>
    );
  }

  return (
    <Surface style={{ marginTop: 14, gap: 12 }}>
      <View style={ui.row}>
        <Text style={[ui.section, { color: colors.ink, marginBottom: 0 }]}>Record payments</Text>
        <Pressable accessibilityRole="button" onPress={() => { setOpen(false); setText(''); setResolved({}); }} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ color: colors.primary }}>Close</Text>
        </Pressable>
      </View>

      <Text style={[ui.description, { color: colors.muted }]}>
        Copy your bKash or Nagad received-money messages and paste them here — all of them at once is fine.
      </Text>

      <TextInput
        accessibilityLabel="Paste payment messages"
        multiline
        placeholder="You have received Tk 366.00 from 01712345678. TrxID …"
        placeholderTextColor={colors.muted}
        value={text}
        onChangeText={setText}
        style={input}
      />

      {result ? (
        <View style={{ gap: 10 }}>
          {result.matched.map(match => (
            <View key={match.transfer.source} style={[ui.row, { paddingVertical: 6 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 14 }}>{match.displayName}</Text>
                {match.kind !== 'exact' ? (
                  <Text style={{ color: colors.amber, fontSize: 12, marginTop: 2 }}>
                    {match.kind === 'short' ? 'Paid less than owed' : 'Paid more than owed'} by {taka(Math.abs(match.difference), currency)}
                  </Text>
                ) : null}
              </View>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>{taka(match.transfer.amount, currency)}</Text>
            </View>
          ))}

          {result.ambiguous.map(entry => (
            <View key={entry.transfer.source} style={{ gap: 6, paddingVertical: 6 }}>
              <Text style={{ color: colors.amber, fontSize: 13 }}>
                {taka(entry.transfer.amount, currency)} fits {entry.candidates.length} people. Who sent it?
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {entry.candidates.map(candidate => (
                  <Pressable
                    key={candidate.guestId}
                    accessibilityRole="button"
                    accessibilityLabel={`Attribute ${taka(entry.transfer.amount, currency)} to ${candidate.displayName}`}
                    onPress={() => setResolved(current => ({ ...current, [entry.transfer.source]: candidate.guestId }))}
                    style={{
                      minHeight: 38, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10,
                      backgroundColor: resolved[entry.transfer.source] === candidate.guestId ? colors.primary : colors.soft,
                    }}
                  >
                    <Text style={{ color: resolved[entry.transfer.source] === candidate.guestId ? '#fff' : colors.primary, fontWeight: '600', fontSize: 13 }}>
                      {candidate.displayName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          {result.unmatched.map(transfer => {
            const near = suggestFor(transfer, expected, 3);
            return (
              <View key={transfer.source} style={{ gap: 6, paddingVertical: 6 }}>
                <Text style={{ color: colors.amber, fontSize: 13 }}>
                  {taka(transfer.amount, currency)} doesn’t match anyone’s share. Attach it to:
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {near.map(option => (
                    <Pressable
                      key={option.guestId}
                      accessibilityRole="button"
                      accessibilityLabel={`Attribute ${taka(transfer.amount, currency)} to ${option.displayName}`}
                      onPress={() => setResolved(current => ({ ...current, [transfer.source]: option.guestId }))}
                      style={{
                        minHeight: 38, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10,
                        backgroundColor: resolved[transfer.source] === option.guestId ? colors.primary : colors.soft,
                      }}
                    >
                      <Text style={{ color: resolved[transfer.source] === option.guestId ? '#fff' : colors.primary, fontWeight: '600', fontSize: 13 }}>
                        {option.displayName} {option.difference > 0 ? `+${taka(option.difference, currency)}` : taka(option.difference, currency)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}

          {result.duplicates.length ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {result.duplicates.length} already recorded, skipped.
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Record ${toApply.length} payments`}
            disabled={toApply.length === 0 || busy}
            onPress={() => { onConfirm(toApply); setText(''); setResolved({}); }}
            style={{
              minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
              backgroundColor: toApply.length && !busy ? colors.primary : colors.soft,
            }}
          >
            <Text style={{ color: toApply.length && !busy ? '#fff' : colors.muted, fontWeight: '700' }}>
              {busy ? 'Recording…' : toApply.length ? `Record ${toApply.length} payment${toApply.length === 1 ? '' : 's'}` : 'Nothing to record yet'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Surface>
  );
}
