import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const production = process.env.APP_VARIANT === 'production';
  const bundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER;
  if (production && !bundleIdentifier) {
    throw new Error('Set IOS_BUNDLE_IDENTIFIER to your registered Apple bundle identifier before a production build.');
  }
  return {
    ...config,
    name: production ? 'SplitSave' : 'SplitSave Preview',
    slug: 'splitsave',
    // Without this a packaged build ships the blank default icon.
    icon: './assets/icon.png',
    ios: {
      ...config.ios,
      bundleIdentifier: bundleIdentifier ?? 'dev.splitsave.preview',
      supportsTablet: false,
      infoPlist: {
        ...(config.ios?.infoPlist ?? {}),
        // Apple rejects a build that opens the camera or library without
        // saying why, even when the feature is reached from one screen.
        NSCameraUsageDescription: 'Take a photo of your receipt to add its items.',
        NSPhotoLibraryUsageDescription: 'Choose a photo of your receipt to add its items.',
      },
    },
  };
};
