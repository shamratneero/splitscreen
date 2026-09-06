import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useTheme } from '../../components/theme';

// UIKit's tab bar adopts Liquid Glass when built with Xcode 26 on iOS 26.
// On older systems UIKit provides the platform-appropriate tab bar material.
export default function NativeTabLayout() {
  const { colors } = useTheme();
  return <NativeTabs tintColor={colors.primary} disableTransparentOnScrollEdge>
    <NativeTabs.Trigger name="index"><Icon sf={{ default: 'house', selected: 'house.fill' }} /><Label>Home</Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="splits"><Icon sf="receipt" /><Label>Splits</Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="profile"><Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} /><Label>Profile</Label></NativeTabs.Trigger>
  </NativeTabs>;
}
