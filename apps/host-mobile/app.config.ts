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
    ios: {
      ...config.ios,
      bundleIdentifier: bundleIdentifier ?? 'dev.splitsave.preview',
      supportsTablet: false,
    },
  };
};
