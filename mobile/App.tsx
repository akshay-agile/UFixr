import React from "react";
import {
  ActivityIndicator,
  View,
  StyleSheet,
  Text,
  StatusBar,
} from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ReportFaultScreen from "./src/screens/ReportFaultScreen";
import MyReportsScreen from "./src/screens/MyReportsScreen";
import NotificationsScreen from "./src/screens/NotificationsScreen";
import { T } from "./src/theme";
import BrandLogo from "./src/components/BrandLogo";

const NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: T.parchment,
    card: T.white,
    text: T.ink,
    border: T.line,
    primary: T.electric,
    notification: T.critical,
  },
};

type TabName = "Home" | "Report Fault" | "My Reports" | "Alerts";

const TAB_CONFIG: Record<TabName, { icon: string; label: string }> = {
  Home: { icon: "🏠", label: "Home" },
  "Report Fault": { icon: "⚡", label: "Report" },
  "My Reports": { icon: "📋", label: "Reports" },
  Alerts: { icon: "🔔", label: "Alerts" },
};

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function AppTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => {
        const cfg = TAB_CONFIG[route.name as TabName];

        return {
          headerShown: false,
          tabBarStyle: {
            backgroundColor: T.white,
            borderTopColor: T.line,
            borderTopWidth: 1,
            height: 90,
            paddingBottom: 12,
            paddingTop: 12,
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
          },
          tabBarActiveTintColor: T.electric,
          tabBarInactiveTintColor: "#999",
          tabBarActiveBackgroundColor: "transparent",
          tabBarInactiveBackgroundColor: "transparent",
          tabBarItemStyle: {
            backgroundColor: "transparent",
            justifyContent: "center",
            alignItems: "center",
          },
          tabBarShowLabel: false,
          tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => (
            <View style={[styles.tabPill, focused && styles.tabPillActive]}>
              <Text
                style={[
                  styles.tabIcon,
                  {
                    color: focused ? T.electric : color,
                    fontSize: focused ? 24 : 22,
                  },
                ]}
              >
                {cfg.icon}
              </Text>
              <Text style={[styles.tabLabel, { color: focused ? T.electric : T.inkFaint }]}>
                {cfg.label}
              </Text>
            </View>
          ),
        };
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Report Fault" component={ReportFaultScreen} />
      <Tabs.Screen name="My Reports" component={MyReportsScreen} />
      <Tabs.Screen name="Alerts" component={NotificationsScreen} />
    </Tabs.Navigator>
  );
}

function RootNavigation() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={T.parchment} />
        <View style={styles.loadingLogo}>
          <Text style={styles.loadingLogoText}>UF</Text>
        </View>
        <Text style={styles.loadingTitle}>UFixr</Text>
        <Text style={styles.loadingSubtitle}>Utility fault response, made visible</Text>
        <ActivityIndicator size="small" color={T.electric} style={{ marginTop: 28 }} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={NavTheme}>
      <StatusBar barStyle="dark-content" backgroundColor={T.parchment} />
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.parchment } }}>
        {token ? (
          <Stack.Screen name="AppTabs" component={AppTabs} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RootNavigation />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: T.parchment,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingLogo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  loadingLogoText: {
    color: T.white,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -1,
  },
  loadingTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: T.ink,
    letterSpacing: -1,
  },
  loadingSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: T.inkMuted,
    textAlign: "center",
  },
  tabPill: {
    minWidth: 64,
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  tabPillActive: {
    backgroundColor: T.electricSoft,
    shadowColor: T.electric,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  tabIcon: {
    fontSize: 22,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 3,
  },
});













