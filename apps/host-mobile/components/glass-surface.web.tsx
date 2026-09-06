import { createElement } from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTheme } from './theme';
import type { GlassSurfaceProps } from './glass-surface.types';

export function GlassSurface({ interactive: _interactive, style, ...props }: GlassSurfaceProps) {
  const { colors, reducedTransparency } = useTheme();
  const material = {
    backgroundColor: reducedTransparency ? colors.surface : colors.glass,
    borderWidth: 1, borderColor: colors.glassEdge, borderRadius: 24,
    backdropFilter: 'blur(24px) saturate(160%)', WebkitBackdropFilter: 'blur(24px) saturate(160%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.45), 0 8px 32px rgba(19,49,34,.09), 0 1px 3px rgba(19,49,34,.06)',
  } as ViewStyle;
  return <View {...props} testID={props.testID ?? 'glass-surface'} style={[material, style]}>
    {createElement('style', null, '@media (prefers-reduced-transparency: reduce) { [data-testid="glass-surface"] { backdrop-filter:none!important; -webkit-backdrop-filter:none!important; background: ' + colors.surface + '!important; } }')}
    {props.children}
  </View>;
}
