import { Tabs } from 'expo-router';
import { Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassSurface } from '../../components/glass-surface';
import { Icon, type IconName } from '../../components/icon';
import { useTheme } from '../../components/theme';
import { Text } from 'react-native';

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.canvas } }} tabBar={({ state, navigation }) => (
    <View pointerEvents="box-none" style={{ position: 'absolute', bottom: Math.max(insets.bottom, 16) + (Platform.OS === 'web' && width >= 760 ? 24 : 0), left: 0, right: 0, alignItems: 'center' }}>
      <GlassSurface style={{ width: '88%', maxWidth: 440, padding: 5, borderRadius: 18, flexDirection: 'row' }}>
        {state.routes.map((route, index) => {
          const selected = state.index === index;
          const names: Record<string, { label: string; icon: IconName }> = { index: { label: 'Home', icon: 'home' }, splits: { label: 'Splits', icon: 'receipt' }, profile: { label: 'Profile', icon: 'person' } };
          const item = names[route.name];
          return <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={item.label}
            onPress={() => { const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!selected && !event.defaultPrevented) navigation.navigate(route.name); }}
            style={{ flex: 1, minHeight: 54, borderRadius: 13, gap: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.soft : 'transparent' }}>
            <Icon name={item.icon} color={selected ? colors.primary : colors.muted} size={21} /><Text style={{ fontSize: 11, fontWeight: '600', color: selected ? colors.primary : colors.muted }}>{item.label}</Text>
          </Pressable>;
        })}
      </GlassSurface>
    </View>
  )}><Tabs.Screen name="index" /><Tabs.Screen name="splits" /><Tabs.Screen name="profile" /></Tabs>;
}
