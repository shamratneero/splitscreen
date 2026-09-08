import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Appearance, Platform, useColorScheme } from 'react-native';

const light = {
  canvas: '#FAF9F6', surface: '#FFFFFF', ink: '#202B26', muted: '#68716A',
  line: '#E4E5DD', primary: '#245C45', soft: '#EAF0E6', glass: 'rgba(250,249,246,0.96)',
  glassEdge: '#E4E5DD', input: '#F3F3ED', amber: '#926020',
};
const dark: typeof light = {
  canvas: '#171E1A', surface: '#202923', ink: '#F5F3EA', muted: '#ADB7AE',
  line: '#39443B', primary: '#A9D3B4', soft: '#2B3D2F', glass: 'rgba(32,41,35,0.96)',
  glassEdge: '#39443B', input: '#19221C', amber: '#E6BB7D',
};
export type AppearanceChoice = 'system' | 'light' | 'dark';
const Theme = createContext({ colors: light, isDark: false, reducedTransparency: true,
  appearance: 'system' as AppearanceChoice, setAppearance: (_value: AppearanceChoice) => {} });

export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [appearance, setAppearance] = useState<AppearanceChoice>('system');
  const [reducedTransparency, setReducedTransparency] = useState(true);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const preference = window.matchMedia('(prefers-reduced-transparency: reduce)');
      const change = () => setReducedTransparency(preference.matches);
      change();
      preference.addEventListener('change', change);
      return () => preference.removeEventListener('change', change);
    }
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled().then(value => { if (active) setReducedTransparency(value); }).catch(() => { if (active) setReducedTransparency(false); });
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReducedTransparency);
    return () => { active = false; subscription.remove(); };
  }, []);
  const isDark = (appearance === 'system' ? system : appearance) === 'dark';
  const chooseAppearance = (value: AppearanceChoice) => {
    setAppearance(value);
    if (Platform.OS !== 'web') Appearance.setColorScheme(value === 'system' ? null : value);
  };
  return <Theme.Provider value={{ colors: isDark ? dark : light, isDark, reducedTransparency, appearance, setAppearance: chooseAppearance }}>{children}</Theme.Provider>;
}
export const useTheme = () => useContext(Theme);
