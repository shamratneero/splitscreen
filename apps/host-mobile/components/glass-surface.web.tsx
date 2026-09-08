import { createElement } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTheme } from './theme';
import type { GlassSurfaceProps } from './glass-surface.types';

export function GlassSurface({ interactive: _interactive, style, ...props }: GlassSurfaceProps) {
  const { colors, reducedTransparency } = useTheme();
  const material = {
    backgroundColor: reducedTransparency ? colors.surface : colors.glass,
    borderWidth: 1, borderColor: colors.glassEdge, borderRadius: 24,
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    boxShadow: '0 4px 20px rgba(20,32,24,.06)',
  } as ViewStyle;
  return <View {...props} testID={props.testID ?? 'glass-surface'} style={[material, style]}>
    {createElement('style', null, '@media (prefers-reduced-transparency: reduce) { [data-testid="glass-surface"] { backdrop-filter:none!important; -webkit-backdrop-filter:none!important; background: ' + colors.surface + '!important; } }')}
    {props.children}
  </View>;
}
