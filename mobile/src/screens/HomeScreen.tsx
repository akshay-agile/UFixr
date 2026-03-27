import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import MapView, { Circle, Marker } from "react-native-maps";
import Screen from "../components/Screen";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

type NearbyItem = {
  id: number;
  utility_type: "electricity" | "water";
  title: string;
  latitude: number;
  longitude: number;
  priority_score?: number;
  report_count?: number;
};

export default function HomeScreen({ navigation }: any) {
  const { token, user, logout } = useAuth();
  const [items, setItems] = useState<NearbyItem[]>([]);
  const [region, setRegion] = useState({
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });

  const load = async () => {
    try {
      let latitude = region.latitude;
      let longitude = region.longitude;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === "granted") {
        const current = await Location.getCurrentPositionAsync({});
        latitude = current.coords.latitude;
        longitude = current.coords.longitude;
        setRegion((prev) => ({ ...prev, latitude, longitude }));
      }

      const response = await apiRequest<{ items: NearbyItem[] }>(
        `/reports/nearby?latitude=${latitude}&longitude=${longitude}`,
        { token }
      );
      setItems(response.items);
    } catch (error) {
      Alert.alert("Could not load map", error instanceof Error ? error.message : "Unknown error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning, {user?.name}</Text>
          <Text style={styles.title}>Faults near you</Text>
        </View>
        <Pressable onPress={logout}>
          <Text style={styles.logout}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroKicker}>Area alert / Bengaluru</Text>
        <Text style={styles.heroHeadline}>Active clusters across your zone</Text>
        <View style={styles.heroChips}>
          <View style={[styles.heroChip, { backgroundColor: "rgba(255,77,28,0.25)" }]}>
            <Text style={styles.heroChipText}>E {items.filter((item) => item.utility_type === "electricity").length} electricity</Text>
          </View>
          <View style={[styles.heroChip, { backgroundColor: "rgba(0,88,204,0.25)" }]}>
            <Text style={styles.heroChipText}>W {items.filter((item) => item.utility_type === "water").length} water</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Quick actions</Text>
      <View style={styles.quickActions}>
        <Pressable style={styles.quickBtn} onPress={() => navigation.navigate("Report Fault")}>
          <View style={[styles.quickIcon, { backgroundColor: T.electricSoft }]}><Text>E</Text></View>
          <Text style={styles.quickLabel}>Report power</Text>
        </Pressable>
        <Pressable style={styles.quickBtn} onPress={() => navigation.navigate("Report Fault")}>
          <View style={[styles.quickIcon, { backgroundColor: T.waterSoft }]}><Text>W</Text></View>
          <Text style={styles.quickLabel}>Report water</Text>
        </Pressable>
        <Pressable style={styles.quickBtn} onPress={load}>
          <View style={[styles.quickIcon, { backgroundColor: T.emeraldSoft }]}><Text>R</Text></View>
          <Text style={styles.quickLabel}>Refresh map</Text>
        </Pressable>
        <Pressable style={styles.quickBtn} onPress={() => navigation.navigate("My Reports")}>
          <View style={[styles.quickIcon, { backgroundColor: T.sand }]}><Text>M</Text></View>
          <Text style={styles.quickLabel}>My reports</Text>
        </Pressable>
      </View>

      <View style={styles.mapCard}>
        <MapView style={styles.map} region={region}>
          {items.map((item) => (
            <Marker
              key={item.id}
              coordinate={{ latitude: item.latitude, longitude: item.longitude }}
              title={item.title}
              pinColor={item.utility_type === "electricity" ? T.electric : T.water}
            />
          ))}
          {items
            .filter((item) => (item.report_count ?? 0) >= 3)
            .map((item) => (
              <Circle
                key={`circle-${item.id}`}
                center={{ latitude: item.latitude, longitude: item.longitude }}
                radius={300}
                strokeColor="rgba(255,77,28,0.7)"
                fillColor="rgba(255,77,28,0.14)"
              />
            ))}
        </MapView>
      </View>

      <Text style={styles.sectionTitle}>Nearby incidents</Text>
      <View style={styles.incidentList}>
        {items.slice(0, 4).map((item) => (
          <View style={styles.incidentRow} key={item.id}>
            <View style={[styles.incidentIcon, { backgroundColor: item.utility_type === "electricity" ? T.electricSoft : T.waterSoft }]}>
              <Text style={{ fontSize: 16 }}>{item.utility_type === "electricity" ? "E" : "W"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.incidentTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.incidentMeta}>{item.report_count ?? 1} reports / Priority {Math.round(item.priority_score ?? 0)}%</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: (item.priority_score ?? 0) >= 70 ? T.criticalSoft : (item.priority_score ?? 0) >= 40 ? T.amberSoft : T.emeraldSoft }]}>
              <Text style={[styles.badgeText, { color: (item.priority_score ?? 0) >= 70 ? "#8a0e0e" : (item.priority_score ?? 0) >= 40 ? "#8a5c00" : "#065c38" }]}>
                {(item.priority_score ?? 0) >= 70 ? "Critical" : (item.priority_score ?? 0) >= 40 ? "Moderate" : "Low"}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    fontSize: 12,
    color: T.inkMuted,
    fontWeight: "300",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: T.ink,
    letterSpacing: -1,
    lineHeight: 30,
  },
  logout: {
    color: T.electric,
    fontWeight: "700",
  },
  heroCard: {
    marginHorizontal: -4,
    borderRadius: 22,
    backgroundColor: T.ink,
    padding: 22,
    marginBottom: 20,
  },
  heroKicker: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroHeadline: {
    fontSize: 22,
    fontWeight: "800",
    color: T.white,
    letterSpacing: -0.8,
    lineHeight: 26,
    marginBottom: 14,
  },
  heroChips: {
    flexDirection: "row",
    gap: 8,
  },
  heroChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: T.white,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: T.inkMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  quickBtn: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    padding: 12,
    borderRadius: 16,
    backgroundColor: T.white,
    borderWidth: 1,
    borderColor: T.line,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: T.inkSoft,
    textAlign: "center",
    lineHeight: 13,
  },
  mapCard: {
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 20,
  },
  map: {
    width: "100%",
    height: 230,
  },
  incidentList: {
    gap: 8,
    marginBottom: 24,
  },
  incidentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: 16,
    backgroundColor: T.white,
    borderWidth: 1,
    borderColor: T.line,
  },
  incidentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  incidentTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: T.ink,
    marginBottom: 2,
  },
  incidentMeta: {
    fontSize: 11,
    color: T.inkMuted,
    fontWeight: "300",
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
});
