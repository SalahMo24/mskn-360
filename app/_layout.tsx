import { NotificationProvider } from "@/contexts/notification.context";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { AuthProvider } from "../contexts/AuthContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthProvider>
    </NotificationProvider>
  );
}
