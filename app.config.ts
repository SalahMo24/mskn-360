import "dotenv/config";
import { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Dynamic Expo config that pulls values from the environment (.env).
 * This file takes precedence over app.json.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const awsRegion =
    process.env.AWS_REGION || process.env.EXPO_PUBLIC_AWS_REGION;
  const awsAccessKeyId =
    process.env.AWS_ACCESS_KEY_ID || process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID;
  const awsSecretAccessKey =
    process.env.AWS_SECRET_ACCESS_KEY ||
    process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY;
  const awsBucketName =
    process.env.AWS_BUCKET_NAME || process.env.EXPO_PUBLIC_AWS_BUCKET;
  const stitchingServiceUrl =
    process.env.STITCHING_SERVICE_URL ||
    process.env.EXPO_PUBLIC_STITCHING_SERVICE_URL;
  const panoramaCreationServiceUrl =
    process.env.PANORAMA_CREATION_SERVICE_URL ||
    process.env.EXPO_PUBLIC_PANORAMA_CREATION_SERVICE_URL;
  const API_URL = process.env.API_URL || process.env.EXPO_BACKEND_URL;
  const androidPackage =
    process.env.ANDROID_PACKAGE ||
    process.env.EXPO_ANDROID_PACKAGE ||
    "com.mskn360.app";
  const iosBundleIdentifier =
    process.env.IOS_BUNDLE_IDENTIFIER ||
    process.env.EXPO_IOS_BUNDLE_IDENTIFIER ||
    "com.mskn360.app";

  return {
    ...config,
    name: "mskn-360",
    slug: "mskn-360",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "mskn360",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: iosBundleIdentifier,
    },
    android: {
      package: androidPackage,
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/icon.png",
        backgroundImage: "./assets/images/icon.png",
        monochromeImage: "./assets/images/icon.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000",
          },
        },
      ],
      "expo-asset",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      awsRegion,
      awsAccessKeyId,
      awsSecretAccessKey,
      awsBucketName,
      stitchingServiceUrl,
      panoramaCreationServiceUrl,
      API_URL,
      eas: {
        projectId: "fbbd4d3c-c2b6-4654-a551-a30d2065f1a5",
      },
    },
  };
};
