import { SafeAreaProvider } from "react-native-safe-area-context";
import LoginScreen from "../components/login.screen";

export default function Login() {
  return (
    <SafeAreaProvider>
      <LoginScreen />
    </SafeAreaProvider>
  );
}
