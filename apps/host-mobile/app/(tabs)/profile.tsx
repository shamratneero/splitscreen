import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Heading, Page, Surface, Toolbar, ui } from '../../components/ui';
import { Icon } from '../../components/icon';
import { useTheme, type AppearanceChoice } from '../../components/theme';
import { useAuth } from '../../state/auth';
import { signOut, updateHostProfile } from '../../lib/supabase';

export default function ProfileScreen() {
  const { colors, appearance, setAppearance } = useTheme();
  const { profile, refreshProfile } = useAuth();
  const [bkash, setBkash] = useState('');
  const [nagad, setNagad] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setBkash(profile?.bkashNumber ?? '');
    setNagad(profile?.nagadNumber ?? '');
  }, [profile]);

  const dirty = bkash !== (profile?.bkashNumber ?? '') || nagad !== (profile?.nagadNumber ?? '');

  const save = async () => {
    setStatus(null);
    try {
      await updateHostProfile({ bkashNumber: bkash, nagadNumber: nagad });
      await refreshProfile();
      setStatus('Saved');
      setTimeout(() => setStatus(null), 2000);
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const input = {
    color: colors.ink,
    backgroundColor: colors.input,
    borderRadius: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 15,
    flex: 1,
  };

  return (
    <Page tabs header={<Toolbar />}>
      <Heading title="Make it yours" subtitle="Small preferences. A familiar feeling." />

      <Text style={[ui.section, { color: colors.ink, marginBottom: 8 }]}>Host account</Text>
      <Surface style={{ gap: 4 }}>
        <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 15 }}>{profile?.displayName || 'Host'}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Signed in</Text>
      </Surface>

      <Text style={[ui.section, { color: colors.ink, marginTop: 24, marginBottom: 4 }]}>Payment numbers</Text>
      <Text style={[ui.description, { color: colors.muted, marginBottom: 10 }]}>
        Guests see these on every bill you share. Leave one blank to hide it.
      </Text>
      <Surface style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ color: '#E2136E', fontWeight: '700', width: 58, fontSize: 13 }}>bKash</Text>
          <TextInput
            accessibilityLabel="bKash number"
            placeholder="01XXXXXXXXX"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            value={bkash}
            onChangeText={setBkash}
            style={input}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ color: '#EE7623', fontWeight: '700', width: 58, fontSize: 13 }}>Nagad</Text>
          <TextInput
            accessibilityLabel="Nagad number"
            placeholder="01XXXXXXXXX"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            value={nagad}
            onChangeText={setNagad}
            style={input}
          />
        </View>
        {dirty ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save payment numbers"
            onPress={save}
            style={{ minHeight: 44, borderRadius: 10, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Save</Text>
          </Pressable>
        ) : null}
        {status ? (
          <Text accessibilityLiveRegion="polite" style={{ color: status === 'Saved' ? colors.primary : colors.amber, fontSize: 12 }}>
            {status}
          </Text>
        ) : null}
      </Surface>

      <Text style={[ui.section, { color: colors.ink, marginTop: 24, marginBottom: 8 }]}>Appearance</Text>
      <Surface>
        <View style={{ flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: colors.input }}>
          {(['system', 'light', 'dark'] as AppearanceChoice[]).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: appearance === value }}
              onPress={() => setAppearance(value)}
              style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: value === appearance ? colors.surface : 'transparent' }}
            >
              <Text style={{ fontSize: 13, color: colors.ink, fontWeight: value === appearance ? '600' : '400' }}>
                {value[0]!.toUpperCase() + value.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Surface>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={signOut}
        style={{ minHeight: 48, marginTop: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
      >
        <Icon name="arrow" size={16} color={colors.amber} />
        <Text style={{ color: colors.amber, fontWeight: '600' }}>Sign out</Text>
      </Pressable>

      <View style={{ paddingTop: 24, gap: 6 }}>
        <Text style={{ textAlign: 'center', color: colors.primary, fontSize: 17, fontWeight: '700' }}>Good food. Fair splits.</Text>
        <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 12 }}>Made for the way we adda.</Text>
      </View>
    </Page>
  );
}
