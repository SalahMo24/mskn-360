import { LoginResponse } from "@/types/login.type";
import Constants from "expo-constants";

import { isTokenValid } from "@/utils/jwt";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}
const loginUrl = `${Constants.expoConfig?.extra?.API_URL}/login`;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in and token is valid
    const checkAuthStatus = async () => {
      try {
        const token = await SecureStore.getItemAsync("token");

        if (token && isTokenValid(token)) {
          setIsAuthenticated(true);
        } else {
          // Token is either missing, invalid, or expired
          setIsAuthenticated(false);

          // If token exists but is invalid/expired, remove it
          if (token) {
            await SecureStore.deleteItemAsync("token");
            await SecureStore.deleteItemAsync("user");
          }
        }
      } catch (error) {
        console.error("Error checking auth status:", error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const login = async (
    phone: string,
    password: string
  ): Promise<LoginResponse> => {
    setIsLoading(true);

    try {
      const response = await fetch(`${loginUrl}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone,
          password: password,
        }),
      });
      const data: LoginResponse = await response.json();
      console.log(data);

      if (data.success) {
        // Validate the received token before storing it
        if (data.token && isTokenValid(data.token)) {
          setIsAuthenticated(true);
          await SecureStore.setItemAsync("token", data.token);
          await SecureStore.setItemAsync("user", JSON.stringify(data.user));
        } else {
          throw new Error("Invalid or expired token received from server");
        }
      } else {
        throw new Error("Invalid credentials");
      }
      return data;
    } catch (error) {
      setIsAuthenticated(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsAuthenticated(false);

    await SecureStore.deleteItemAsync("token");
    await SecureStore.deleteItemAsync("user");
  };

  const value = {
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
