import { Stack } from "expo-router";
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../components/theme';
import { DraftProvider } from '../state/draft';

export default function RootLayout() {
  return <SafeAreaProvider><ThemeProvider><DraftProvider><Navigation /></DraftProvider></ThemeProvider></SafeAreaProvider>;
}

function Navigation() {
  const { colors, isDark } = useTheme();
  return <><StatusBar style={isDark ? 'light' : 'dark'} /><Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.canvas } }} /></>;
}
