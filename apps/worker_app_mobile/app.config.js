/**
 * Expo config — API URL: set EXPO_PUBLIC_API_URL or extra.apiUrl below.
 * Physical device: use your machine's LAN IP (e.g. http://192.168.1.10:8000).
 * Android emulator: http://10.0.2.2:8000
 */
module.exports = {
  expo: {
    name: "Ops Intel Worker",
    slug: "ops-intel-worker",
    version: "1.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    splash: {
      resizeMode: "contain",
      backgroundColor: "#EDF0F5",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.opsintel.worker",
    },
    android: {
      package: "com.opsintel.worker",
      usesCleartextTraffic: true,
    },
    plugins: ["expo-asset", "expo-font", "expo-notifications"],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000",
      eas: {
        projectId: process.env.EAS_PROJECT_ID,
      },
    },
  },
};
