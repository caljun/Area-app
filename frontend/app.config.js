try {
  require('dotenv/config');
} catch (error) {
  // dotenv is not available in EAS build environment
}

export default {
  expo: {
    name: 'Area',
    slug: 'area',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'area',
    userInterfaceStyle: 'light',
    icon: './assets/images/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yourapp.areaapp",
      buildNumber: "11",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/icon.png',
        backgroundColor: '#FFFFFF',
      },
    },
    web: {
      favicon: './assets/images/favicon.png',
    },
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://area-app.onrender.com/api",
      expoRouterRoot: process.env.EXPO_ROUTER_APP_ROOT ?? 'app',
      eas: {
        projectId: "b1b20e10-b45e-4f5f-a0c5-3e2bdab5b2c7"
      }
    },
    plugins: [
      [
        "expo-build-properties",
        {
          ios: {
            deploymentTarget: "14.0"
          }
        }
      ]
    ]
  },
};

