import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Platform, Pressable, Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Button, Heading, Page, Surface, Toolbar, ui } from '../components/ui';
import { GlassSurface } from '../components/glass-surface';
import { Icon } from '../components/icon';
import { useTheme } from '../components/theme';

export default function ShareScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [notice, setNotice] = useState('');
  const baseURL = process.env.EXPO_PUBLIC_GUEST_URL ?? 'http://localhost:3000';
  const url = `${baseURL.replace(/\/$/, '')}/s/demo-sultans-dine`;
  const copy = async () => { try { if (Platform.OS === 'web') { await navigator.clipboard.writeText(url); setNotice('Link copied'); } else { await Share.share({ message: url, url }); } } catch { setNotice('Couldn’t share the link. Try again.'); } };
  return <Page header={<Toolbar title="Invite your table" onBack={() => router.back()} />} footer={<Button title="Back to home" secondary onPress={() => router.replace('/')} />}>
    <View style={{ paddingTop: 16 }}><Heading centered title="Share with your friends" subtitle="They don’t need the app. Just a seat at your table." /></View>
    <GlassSurface style={{ padding: 24, alignSelf: 'center', marginVertical: 16, borderRadius: 30 }}>
      <View style={{ padding: 16, borderRadius: 14, backgroundColor: '#FFFFFF' }}><QRCode value={url} size={190} color="#173A2A" backgroundColor="#FFFFFF" /></View>
    </GlassSurface>
    <Surface style={{ padding: 12, marginTop: 16 }}><View style={ui.row}><View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 11, marginBottom: 4 }}>Demo link</Text><Text selectable style={{ color: colors.ink, fontSize: 12 }}>…/s/demo-sultans-dine</Text></View><Pressable accessibilityRole="button" accessibilityLabel={Platform.OS === 'web' ? 'Copy demo link' : 'Share demo link'} onPress={copy} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.soft }}><Icon name={Platform.OS === 'web' ? 'copy' : 'share'} color={colors.primary} size={19} /></Pressable></View></Surface>
    <Text accessibilityLiveRegion="polite" style={{ color: colors.primary, textAlign: 'center', minHeight: 24, fontSize: 12, marginTop: 8 }}>{notice}</Text>
    <View style={{ padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.soft, borderRadius: 16, marginTop: 16 }}><Icon name="people" color={colors.primary} /><Text style={{ color: colors.primary, fontSize: 13, flex: 1 }}>You can claim your items too.</Text></View>
    <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 18, textAlign: 'center' }}>This preview opens the sample bill. Your draft hasn’t been published yet.</Text>
  </Page>;
}
