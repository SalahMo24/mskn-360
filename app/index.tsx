import { SafeAreaProvider } from "react-native-safe-area-context";
import DashboardScreen from "../components/virtual-tour/screens/dashboard.screen";

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
  return (
    <SafeAreaProvider>
      <DashboardScreen />
    </SafeAreaProvider>
  );
}
