import { Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { GlassSurface } from '../../components/glass-surface';
import { Icon, type IconName } from '../../components/icon';
import { useTheme } from '../../components/theme';
import { Text } from 'react-native';

export default function TabLayout() {
  const { colors } = useTheme();
  return <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.canvas } }} tabBar={({ state, navigation }) => (
    <View pointerEvents="box-none" style={{ position: 'absolute', bottom: 18, left: 0, right: 0, alignItems: 'center' }}>
      <GlassSurface style={{ width: '88%', maxWidth: 408, padding: 6, borderRadius: 32, flexDirection: 'row' }}>
        {state.routes.map((route, index) => {
          const selected = state.index === index;
          const names: Record<string, { label: string; icon: IconName }> = { index: { label: 'Home', icon: 'home' }, splits: { label: 'Splits', icon: 'receipt' }, profile: { label: 'Profile', icon: 'person' } };
          const item = names[route.name];
          return <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={item.label}
            onPress={() => { const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true }); if (!selected && !event.defaultPrevented) navigation.navigate(route.name); }}
            style={{ flex: 1, minHeight: 56, borderRadius: 26, gap: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.soft : 'transparent' }}>
            <Icon name={item.icon} color={selected ? colors.primary : colors.muted} size={21} /><Text style={{ fontSize: 11, fontWeight: '600', color: selected ? colors.primary : colors.muted }}>{item.label}</Text>
          </Pressable>;
        })}
      </GlassSurface>
    </View>
  )}><Tabs.Screen name="index" /><Tabs.Screen name="splits" /><Tabs.Screen name="profile" /></Tabs>;
}
