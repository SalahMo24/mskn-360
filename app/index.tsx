import { useRouter } from "expo-router";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import LoginScreen from "../components/login.screen";
import DashboardScreen from "../components/virtual-tour/screens/dashboard.screen";
import { useAuth } from "../contexts/AuthContext";

const mockProjects = [
  {
    id: "1",
    image:
      "https://test-go-igcse-project-bucket.s3.amazonaws.com/panorama-images/1758776594039.png",
    title: "Sample Project 1",
    createdAt: new Date(),
  },
  {
    id: "2",
    image:
      "https://test-go-igcse-project-bucket.s3.amazonaws.com/panorama-images/1758776594039.png",
    title: "Sample Project 2",
    createdAt: new Date(),
  },
];

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
