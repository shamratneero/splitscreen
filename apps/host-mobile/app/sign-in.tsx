import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Button, Heading, Page, Toolbar, editorialFont } from '../components/ui';
import { Icon } from '../components/icon';
import { useTheme } from '../components/theme';
import { consumeAuthRedirectError, signIn, signUp } from '../lib/supabase';

export default function SignInScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // A failed confirmation link lands back here with the reason in the fragment.
  useEffect(() => {
    const redirectError = consumeAuthRedirectError();
    if (redirectError) setError(redirectError);
  }, []);

  const creating = mode === 'up';
  const canSubmit = email.trim().length > 3 && (creating ? password.length >= 6 : password.length > 0) && (!creating || name.trim().length > 0);

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (creating) {
        const result = await signUp(email, password, name);
        if (result === 'confirm-email') {
          setNotice(`Confirmation sent to ${email.trim()}. Open it on this device, then sign in.`);
          setMode('in');
        }
      } else {
        await signIn(email, password);
      }
      // AuthProvider picks the new session up and swaps the tabs in.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const input = {
    color: colors.ink,
    backgroundColor: colors.input,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: 14,
    fontSize: 15,
  };

  return (
    <Page wide={desktop} header={<Toolbar />}>
      <View style={{ flex: 1, flexDirection: desktop ? 'row' : 'column', alignItems: desktop ? 'center' : 'stretch', justifyContent: 'center', gap: desktop ? 56 : 0, paddingHorizontal: desktop ? 24 : 0, paddingBottom: 40 }}>
        {desktop ? <View style={{ flex: 1, paddingBottom: 20 }}>
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 22 }}>FOR THE WHOLE TABLE</Text>
          <Text style={{ color: colors.ink, fontFamily: editorialFont, fontSize: 58, lineHeight: 64, letterSpacing: -2 }}>Good food.{ '\n' }Fair splits.</Text>
          <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 26, marginTop: 20, maxWidth: 300 }}>Keep the conversation going. SplitUp takes care of who owes what.</Text>
          <View style={{ gap: 20, marginTop: 38 }}>
            {(['Add the receipt', 'Let everyone choose their items', 'Keep track of payments'] as const).map((label, i) => <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] }}>0{i + 1}</Text><Text style={{ color: colors.ink, fontSize: 14 }}>{label}</Text></View>)}
          </View>
        </View> : null}
      <View style={{ flex: desktop ? 1 : undefined, width: '100%', maxWidth: desktop ? 390 : undefined }}>
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}><Icon name="people" color={colors.primary} size={25} /></View>
        <Heading
          title={creating ? 'Create your account' : 'Welcome back'}
          subtitle={creating ? 'A home for your bills and the people you share them with.' : 'Your table. Your splits. All in one place.'}
        />

        <View style={{ gap: 10, marginTop: 8 }}>
          {creating ? (
            <>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '600' }}>Your name</Text>
            <TextInput
              accessibilityLabel="Your name"
              placeholder="Your name"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
              style={input}
            />
            </>
          ) : null}
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '600' }}>Email</Text>
          <TextInput
            accessibilityLabel="Email"
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            style={input}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '600' }}>Password</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(!showPassword)} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
              <Text style={{ color: colors.primary, fontSize: 13 }}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel="Password"
            placeholder={creating ? "At least 6 characters" : "Your password"}
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            secureTextEntry={!showPassword}
            onSubmitEditing={submit}
            returnKeyType="go"
            autoCapitalize="none"
            textContentType={creating ? 'newPassword' : 'password'}
            value={password}
            onChangeText={setPassword}
            style={input}
          />
        </View>

        {error ? (
          <Text accessibilityLiveRegion="polite" style={{ color: colors.amber, fontSize: 13, marginTop: 14, textAlign: 'center', lineHeight: 19 }}>
            {error}
          </Text>
        ) : null}

        {notice ? (
          <Text accessibilityLiveRegion="polite" style={{ color: colors.primary, fontSize: 13, marginTop: 14, textAlign: 'center', lineHeight: 19 }}>
            {notice}
          </Text>
        ) : null}

        <View style={{ marginTop: 20 }}>
          <Button title={busy ? (creating ? 'Creating account…' : 'Signing in…') : (creating ? 'Create account' : 'Sign in')} onPress={submit} disabled={!canSubmit || busy} />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMode(creating ? 'in' : 'up');
            setError(null);
            setNotice(null);
            setShowPassword(false);
          }}
          disabled={busy}
          style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}
        >
          <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>
            {creating ? 'I already have an account' : 'Create a new account'}
          </Text>
        </Pressable>
        <View style={{ borderTopWidth: 1, borderColor: colors.line, marginTop: 24, paddingTop: 20, flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name="share" size={16} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, flex: 1 }}>Hosting takes an account. Friends just open your link.</Text></View>
      </View>
      </View>
    </Page>
  );
}
