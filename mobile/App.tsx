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
  Home: { icon: "¦", label: "Home" },
  "Report Fault": { icon: "+", label: "Report" },
  "My Reports": { icon: "R", label: "Reports" },
  Alerts: { icon: "A", label: "Alerts" },
};

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function AppTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => {
        const cfg = TAB_CONFIG[route.name as TabName];
        const isReport = route.name === "Report Fault";

        return {
          headerShown: false,
          tabBarStyle: {
            backgroundColor: T.white,
            borderTopColor: T.line,
            height: 84,
            paddingBottom: 20,
            paddingTop: 8,
          },
          tabBarActiveTintColor: T.electric,
          tabBarInactiveTintColor: T.inkFaint,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "600",
            marginTop: -2,
          },
          tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => {
            if (isReport) {
              return (
                <View style={styles.reportFab}>
                  <Text style={styles.reportFabIcon}>+</Text>
                </View>
              );
            }

            return (
              <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
                <Text style={[styles.tabIcon, { color }]}>{cfg.icon}</Text>
              </View>
            );
          },
          tabBarLabel: ({ focused }: { focused: boolean }) => (
            <Text style={[styles.tabLabel, { color: focused ? T.electric : T.inkFaint }]}>
              {cfg.label}
            </Text>
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
  tabIconWrap: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrapActive: {
    backgroundColor: T.electricSoft,
  },
  tabIcon: {
    fontSize: 16,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  reportFab: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: T.electric,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
    shadowColor: T.electric,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  reportFabIcon: {
    fontSize: 22,
    color: T.white,
    fontWeight: "700",
    lineHeight: 22,
  },
});






