import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button, Heading, Page, Surface, Toolbar, ui } from '../components/ui';
import { GlassSurface } from '../components/glass-surface';
import { Icon } from '../components/icon';
import { useTheme } from '../components/theme';
import { useDraft } from '../state/draft';
import { publishSplit } from '../lib/publish-split';
import { isSupabaseConfigured } from '../lib/supabase';

export default function ShareScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { draft } = useDraft();
  const [notice, setNotice] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Publish the draft once, on arrival, so the QR encodes this real bill.
  useEffect(() => {
    let cancelled = false;
    if (!isSupabaseConfigured) {
      setError('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo.');
      return;
    }
    publishSplit(draft)
      .then((publicToken) => !cancelled && setToken(publicToken))
      .catch((cause) => !cancelled && setError(cause instanceof Error ? cause.message : String(cause)));
    return () => {
      cancelled = true;
    };
    // Publishing is intentionally a one-shot effect for this screen visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const baseURL = process.env.EXPO_PUBLIC_GUEST_URL ?? 'http://localhost:3000';
  const url = token ? `${baseURL.replace(/\/$/, '')}/s/${token}` : '';

  const copy = async () => {
    if (!url) return;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(url);
        setNotice('Link copied');
      } else {
        await Share.share({ message: url, url });
      }
    } catch {
      setNotice('Couldn’t share the link. Try again.');
    }
  };

  return (
    <Page
      header={<Toolbar title="Invite your table" onBack={() => router.back()} />}
      footer={<Button title="Back to home" secondary onPress={() => router.replace('/')} />}
    >
      <View style={{ paddingTop: 16 }}>
        <Heading centered title="Share with your friends" subtitle="They don’t need the app. Just a seat at your table." />
      </View>

      <GlassSurface style={{ padding: 24, alignSelf: 'center', marginVertical: 16, borderRadius: 30 }}>
        <View style={{ padding: 16, borderRadius: 14, backgroundColor: '#FFFFFF', minWidth: 222, minHeight: 222, alignItems: 'center', justifyContent: 'center' }}>
          {token ? (
            <QRCode value={url} size={190} color="#173A2A" backgroundColor="#FFFFFF" />
          ) : error ? (
            <Icon name="receipt" size={40} color={colors.amber} />
          ) : (
            <ActivityIndicator color="#173A2A" />
          )}
        </View>
      </GlassSurface>

      {error ? (
        <Surface style={{ padding: 14 }}>
          <Text style={{ color: colors.amber, fontSize: 13 }}>{error}</Text>
        </Surface>
      ) : (
        <Surface style={{ padding: 12, marginTop: 16 }}>
          <View style={ui.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>Guest link</Text>
              <Text selectable style={{ color: colors.ink, fontSize: 12 }}>
                {token ? `…/s/${token.slice(0, 8)}…` : 'Publishing your bill…'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={Platform.OS === 'web' ? 'Copy guest link' : 'Share guest link'}
              disabled={!token}
              onPress={copy}
              style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.soft, opacity: token ? 1 : 0.4 }}
            >
              <Icon name={Platform.OS === 'web' ? 'copy' : 'share'} color={colors.primary} size={19} />
            </Pressable>
          </View>
        </Surface>
      )}

      <Text accessibilityLiveRegion="polite" style={{ color: colors.primary, textAlign: 'center', minHeight: 24, fontSize: 12, marginTop: 8 }}>{notice}</Text>

      <View style={{ padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.soft, borderRadius: 16, marginTop: 16 }}>
        <Icon name="people" color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 13, flex: 1 }}>You can claim your items too.</Text>
      </View>

      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 18, textAlign: 'center' }}>
        {token ? 'This link is live. Anyone who opens it can claim their items.' : 'Publishing this bill to your guests…'}
      </Text>
    </Page>
  );
}
