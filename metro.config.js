// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Store original resolveRequest if it exists
const originalResolveRequest = config.resolver?.resolveRequest;

// Only customize resolver if we need to handle react-native-maps for web
if (originalResolveRequest) {
  config.resolver = {
    ...config.resolver,
    resolveRequest: (context, moduleName, platform) => {
      // On web, redirect react-native-maps and ALL its sub-modules to web stub
      if (platform === 'web') {
        // Check if it's react-native-maps or any sub-path
        if (moduleName === 'react-native-maps' || 
            moduleName.startsWith('react-native-maps/') ||
            moduleName.includes('react-native-maps')) {
          return {
            filePath: require.resolve('./src/utils/webMapsStub.js'),
            type: 'sourceFile',
          };
        }
        // Check if the import originated from react-native-maps package
        const originPath = context.originModulePath || '';
        if (originPath && (
          originPath.includes('node_modules/react-native-maps') ||
          originPath.includes('react-native-maps')
        )) {
          return {
            filePath: require.resolve('./src/utils/webMapsStub.js'),
            type: 'sourceFile',
          };
        }
        // Handle nested imports from react-native-maps (like MapMarkerNativeComponent)
        if (moduleName.includes('codegenNativeCommands') && originPath && originPath.includes('react-native-maps')) {
          return {
            filePath: require.resolve('./src/utils/webMapsStub.js'),
            type: 'sourceFile',
          };
        }
      }
      // For all other cases, use default resolution
      return originalResolveRequest(context, moduleName, platform);
    },
  };
} else {
  // Fallback if originalResolveRequest doesn't exist
  config.resolver = {
    ...config.resolver,
    resolveRequest: (context, moduleName, platform) => {
      if (platform === 'web' && moduleName === 'react-native-maps') {
        return {
          filePath: require.resolve('./src/utils/webMapsStub.js'),
          type: 'sourceFile',
        };
      }
      // Use default Metro resolver
      return context.resolveRequest(context, moduleName, platform);
    },
  };
}

// Suppress the expo-platform error by providing a default platform
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Ensure req.query exists
      if (!req.query) {
        req.query = {};
      }
      
      // Auto-detect platform from User-Agent if missing
      if (!req.headers['expo-platform'] && !req.query.platform) {
        const userAgent = req.headers['user-agent'] || '';
        if (userAgent.includes('Android') || userAgent.includes('android')) {
          req.query.platform = 'android';
          req.headers['expo-platform'] = 'android';
        } else if (userAgent.includes('iPhone') || userAgent.includes('iPad') || userAgent.includes('iOS')) {
          req.query.platform = 'ios';
          req.headers['expo-platform'] = 'ios';
        } else {
          // Default to android
          req.query.platform = 'android';
          req.headers['expo-platform'] = 'android';
        }
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;

