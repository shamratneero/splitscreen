import { View } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from './theme';
import type { GlassSurfaceProps } from './glass-surface.types';

export function GlassSurface({ interactive = false, style, ...props }: GlassSurfaceProps) {
  const { colors, isDark, reducedTransparency } = useTheme();
  const shape = { borderRadius: 24, overflow: 'hidden' as const };
  if (reducedTransparency) {
    return <View {...props} style={[shape, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }, style]} />;
  }
  if (isGlassEffectAPIAvailable() && isLiquidGlassAvailable()) {
    return <GlassView {...props} key={String(interactive)} isInteractive={interactive}
      glassEffectStyle="regular" colorScheme={isDark ? 'dark' : 'light'} style={[shape, style]} />;
  }
  return <BlurView {...props} intensity={65} tint={isDark ? 'systemMaterialDark' : 'systemMaterialLight'} style={[shape, style]} />;
}
