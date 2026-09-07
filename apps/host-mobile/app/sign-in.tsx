import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Button, Heading, Page, Surface } from '../components/ui';
import { useTheme } from '../components/theme';
import { signIn, signUp } from '../lib/supabase';

export default function SignInScreen() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creating = mode === 'up';
  const canSubmit = email.trim().length > 3 && password.length >= 6 && (!creating || name.trim().length > 0);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (creating) await signUp(email, password, name);
      else await signIn(email, password);
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
    <Page>
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
        <Heading
          centered
          title={creating ? 'Create your account' : 'Welcome back'}
          subtitle={creating ? 'So your splits and payments stay in one place.' : 'Sign in to pick up where you left off.'}
        />

        <Surface style={{ gap: 12, marginTop: 24 }}>
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
          <TextInput
            accessibilityLabel="Password"
            placeholder="Password (at least 6 characters)"
            placeholderTextColor={colors.muted}
            secureTextEntry
            autoCapitalize="none"
            textContentType={creating ? 'newPassword' : 'password'}
            value={password}
            onChangeText={setPassword}
            style={input}
          />
        </Surface>

        {error ? (
          <Text accessibilityLiveRegion="polite" style={{ color: colors.amber, fontSize: 13, marginTop: 14, textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}

        <View style={{ marginTop: 20 }}>
          {busy ? (
            <View style={{ minHeight: 52, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <Button title={creating ? 'Create account' : 'Sign in'} onPress={submit} disabled={!canSubmit} />
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMode(creating ? 'in' : 'up');
            setError(null);
          }}
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
