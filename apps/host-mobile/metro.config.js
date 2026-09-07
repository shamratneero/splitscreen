const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Use Metro's filesystem watcher for this workspace. An existing home-directory
// Watchman watch can otherwise crawl unrelated projects and stall startup.
config.resolver.useWatchman = false;

// Expo's development env module also reads dotenv files through require.context.
// Honor EXPO_NO_DOTENV there so isolated tests use their supplied environment.
if (process.env.EXPO_NO_DOTENV === '1') {
  config.resolver.blockList = [/[/\\]\.env(?:\.[^/\\]*)?$/];
}

// The host and guest intentionally use different React versions. In this
// pnpm workspace a dependency can fall back to the guest's React instead of
// the host renderer's copy. Resolve React and all renderer/runtime
// subpaths from the host so every component shares one hook dispatcher.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'react' || moduleName.startsWith('react/') ||
    moduleName === 'react-dom' || moduleName.startsWith('react-dom/')
  ) {
    return context.resolveRequest(
      { ...context, originModulePath: __filename },
      moduleName,
      platform,
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
