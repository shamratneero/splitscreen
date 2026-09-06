import { View } from 'react-native';
import { useTheme } from './theme';
import type { GlassSurfaceProps } from './glass-surface.types';

// Opaque, readable fallback on Android and other unsupported platforms.
export function GlassSurface({ interactive: _interactive, style, ...props }: GlassSurfaceProps) {
  const { colors } = useTheme();
  return <View {...props} style={[{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 24 }, style]} />;
}
