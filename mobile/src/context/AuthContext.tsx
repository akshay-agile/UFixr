import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiRequest } from "../api/client";

type User = {
  id: number;
  name: string;
  phone: string;
};

type AuthContextValue = {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (name: string, phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const storedToken = await AsyncStorage.getItem("token");
      const storedUser = await AsyncStorage.getItem("user");
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
      setLoading(false);
    };

    bootstrap();
  }, []);

  const storeSession = async (nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    await AsyncStorage.setItem("token", nextToken);
    await AsyncStorage.setItem("user", JSON.stringify(nextUser));
  };

  const login = async (phone: string, password: string) => {
    const response = await apiRequest<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { phone, password },
    });
    await storeSession(response.token, response.user);
  };

  const register = async (name: string, phone: string, password: string) => {
    const response = await apiRequest<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: { name, phone, password },
    });
    await storeSession(response.token, response.user);
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.multiRemove(["token", "user"]);
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
