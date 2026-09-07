import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Button, Heading, Page, Toolbar } from '../components/ui';
import { useTheme } from '../components/theme';
import { consumeAuthRedirectError, signIn, signUp } from '../lib/supabase';

export default function SignInScreen() {
  const { colors } = useTheme();
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
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: 14,
    fontSize: 15,
  };

  return (
    <Page header={<Toolbar />}>
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
        <Heading
          centered
          title={creating ? 'Create your account' : 'Welcome back'}
          subtitle={creating ? 'So your splits and payments stay in one place.' : 'Sign in to pick up where you left off.'}
        />

        <View style={{ gap: 10, marginTop: 8 }}>
          {creating ? (
            <TextInput
              accessibilityLabel="Your name"
              placeholder="Your name"
              placeholderTextColor={colors.muted}
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
              style={input}
            />
          ) : null}
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '600' }}>Email</Text>
          <TextInput
            accessibilityLabel="Email"
            placeholder="Email"
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
      </View>
    </Page>
  );
}
