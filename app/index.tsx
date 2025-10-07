import { useRouter } from "expo-router";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import DashboardScreen from "../components/virtual-tour/screens/dashboard.screen";
import LoginScreen from "../components/virtual-tour/screens/login.screen";
import { useAuth } from "../contexts/AuthContext";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // User is not authenticated, redirect to login
      router.replace("/login" as any);
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    // Show loading screen while checking auth status
    return (
      <SafeAreaProvider>
        <LoginScreen />
      </SafeAreaProvider>
    );
  }

  if (!isAuthenticated) {
    // This should be handled by the useEffect redirect
    return (
      <SafeAreaProvider>
        <LoginScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <DashboardScreen />
    </SafeAreaProvider>
  );
}
