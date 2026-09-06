import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Appearance, Platform, useColorScheme } from 'react-native';

const light = {
  canvas: '#F5F7F4', surface: '#FFFFFF', ink: '#15251F', muted: '#66756D',
  line: '#E3E9E3', primary: '#096544', soft: '#E6F2E9', glass: 'rgba(255,255,255,0.74)',
  glassEdge: 'rgba(255,255,255,0.92)', input: '#F4F6F3', amber: '#986116',
};
const dark: typeof light = {
  canvas: '#101B17', surface: '#1C2A23', ink: '#F3F6F1', muted: '#A8B8AE',
  line: '#32453A', primary: '#7ED2A5', soft: '#243E31', glass: 'rgba(28,42,35,0.83)',
  glassEdge: 'rgba(216,238,221,0.17)', input: '#17231D', amber: '#E2B777',
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
