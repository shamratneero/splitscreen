import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from "expo-router";
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../components/theme';
import { WebPolish } from '../components/web-polish';
import { DraftProvider } from '../state/draft';
import { AuthProvider, useAuth } from '../state/auth';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <WebPolish />
        <AuthProvider>
          <DraftProvider>
            <Navigation />
          </DraftProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Navigation() {
  const { colors, isDark } = useTheme();
  const { hostId } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // undefined means the stored session is still loading — don't redirect yet.
    if (hostId === undefined) return;
    const onSignIn = segments[0] === 'sign-in';
    if (!hostId && !onSignIn) router.replace('/sign-in');
    else if (hostId && onSignIn) router.replace('/');
  }, [hostId, segments, router]);

  if (hostId === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.canvas } }} />
    </>
  );
}
