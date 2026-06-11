// Keep in sync with lib/app-name.ts and lib/app-id.ts
const APP_DISPLAY_NAME = "LM Link for Android";
const ANDROID_PACKAGE = "com.lmlink.android";

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: APP_DISPLAY_NAME,
  slug: "lm-link",
  owner: "mohana-moganti",
  version: "1.0.0",
  sdkVersion: "54.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  scheme: "lm-link",
  ios: {
    supportsTablet: true,
    bundleIdentifier: ANDROID_PACKAGE,
  },
  android: {
    versionCode: 1,
    package: ANDROID_PACKAGE,
    softwareKeyboardLayoutMode: "resize",
    adaptiveIcon: {
      backgroundColor: "#5B4FCF",
      foregroundImage: "./assets/adaptive-icon.png",
    },
    /** Static splash before JS loads — animated opening uses hero-animation.gif. */
    splash: {
      backgroundColor: "#000000",
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
    },
    permissions: [
      "android.permission.INTERNET",
      "android.permission.ACCESS_NETWORK_STATE",
      "android.permission.ACCESS_WIFI_STATE",
      "android.permission.CHANGE_WIFI_MULTICAST_STATE",
      "android.permission.CAMERA",
    ],
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.SYSTEM_ALERT_WINDOW",
      /** Gallery via Android photo picker — no broad media library access (Play policy). */
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
    ],
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#000000",
        image: "./assets/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        dark: {
          backgroundColor: "#000000",
          image: "./assets/splash-icon.png",
          imageWidth: 200,
        },
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Allow LM Link to attach photos from your library in chat.",
        cameraPermission: "Allow LM Link to take photos for chat.",
      },
    ],
    "expo-file-system",
    ["llama.rn", {}],
    "expo-secure-store",
    "./plugins/withLocalNetworkAccess.js",
    "expo-font",
    "expo-audio",
  ],
  extra: {
    router: {},
    eas: {
      projectId: "2d945c44-03ba-42c9-8362-e77279802b2b",
    },
  },
};

module.exports = config;
