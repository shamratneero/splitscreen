import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const production = process.env.APP_VARIANT === 'production';
  const bundleIdentifier = process.env.IOS_BUNDLE_IDENTIFIER;
  if (production && !bundleIdentifier) {
    throw new Error('Set IOS_BUNDLE_IDENTIFIER to your registered Apple bundle identifier before a production build.');
  }
  return {
    ...config,
    name: production ? 'AddaSplit' : 'AddaSplit Preview',
    slug: 'addasplit',
    ios: {
      ...config.ios,
      bundleIdentifier: bundleIdentifier ?? 'dev.addasplit.preview',
      supportsTablet: false,
    },
  };
};
