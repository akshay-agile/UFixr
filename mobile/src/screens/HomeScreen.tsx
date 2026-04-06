import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View, Modal, FlatList } from "react-native";
import * as Location from "expo-location";
import MapView, { Circle, Heatmap, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import Screen from "../components/Screen";
import StatusIndicator from "../components/StatusIndicator";
import ProgressCircle from "../components/ProgressCircle";
import AnimatedCard from "../components/AnimatedCard";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

type NearbyItem = {
  id: number;
  utility_type: "electricity" | "water";
  title: string;
  status: string;
  latitude: number;
  longitude: number;
  priority_score?: number;
  report_count?: number;
  estimated_people?: number;
  estimated_resolution_minutes?: number;
  priority_reasons?: string[];
  radius_meters?: number;
  cluster_age_hours?: number;
};

export default function HomeScreen({ navigation }: any) {
  const { token, user, logout } = useAuth();
  const [items, setItems] = useState<NearbyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [region, setRegion] = useState({ latitude: 12.9716, longitude: 77.5946, latitudeDelta: 0.08, longitudeDelta: 0.08 });
  const [showAllIssues, setShowAllIssues] = useState(false);
  const [mapExpandedModal, setMapExpandedModal] = useState(false);

  const load = async () => {
    try {
      if (!loading) setRefreshing(true);
      let latitude = region.latitude;
      let longitude = region.longitude;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === "granted") {
        const current = await Location.getCurrentPositionAsync({});
        latitude = current.coords.latitude;
        longitude = current.coords.longitude;
        setRegion((prev) => ({ ...prev, latitude, longitude }));
      }

      const response = await apiRequest<{ items: NearbyItem[] }>(`/reports/nearby?latitude=${latitude}&longitude=${longitude}`, { token });
      setItems(response.items);
    } catch (error) {
      Alert.alert("Could not load map", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const activeNearby = useMemo(() => items.filter((item) => item.status !== "resolved"), [items]);
  const electricityCount = activeNearby.filter((item) => item.utility_type === "electricity").length;
  const waterCount = activeNearby.filter((item) => item.utility_type === "water").length;
  const avgPriority = activeNearby.length > 0 ? Math.round(activeNearby.reduce((sum, item) => sum + (item.priority_score ?? 0), 0) / activeNearby.length) : 0;
  const nearestCluster = activeNearby[0];
  const heatmapPoints = useMemo(
    () =>
      activeNearby.map((item) => ({
        latitude: item.latitude,
        longitude: item.longitude,
        weight: Math.max(1, (item.priority_score ?? 30) / 30),
      })),
    [activeNearby]
  );

  return (
    <Screen>
      {/* Header - Clean & Simple */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(" ")[0]}</Text>
          <Text style={styles.title}>Your Area</Text>
        </View>
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      {/* Primary Alert Card - Show Only Most Important */}
      {activeNearby.length > 0 ? (
        <AnimatedCard delay={100}>
          <View style={styles.alertCard}>
            <View style={styles.alertTop}>
              <StatusIndicator status="loading" count={activeNearby.length} label="Active" />
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>Utility Issues Detected</Text>
                <Text style={styles.alertDesc}>Near your location right now</Text>
              </View>
              <ProgressCircle value={avgPriority} size={50} thickness={3} color={avgPriority >= 70 ? T.critical : avgPriority >= 40 ? T.warning : T.success} />
            </View>
            
            <View style={styles.alertStats}>
              {electricityCount > 0 && (
                <View style={styles.statChip}>
                  <Text style={styles.statIcon}>⚡</Text>
                  <Text style={styles.statText}>{electricityCount} Power</Text>
                </View>
              )}
              {waterCount > 0 && (
                <View style={styles.statChip}>
                  <Text style={styles.statIcon}>💧</Text>
                  <Text style={styles.statText}>{waterCount} Water</Text>
                </View>
              )}
            </View>
          </View>
        </AnimatedCard>
      ) : (
        <AnimatedCard delay={100}>
          <View style={styles.clearCard}>
            <Text style={styles.clearIcon}>✓</Text>
            <Text style={styles.clearTitle}>All Clear</Text>
          <Text style={styles.clearDesc}>No active issues in your area</Text>
        </View>
        </AnimatedCard>
      )}

      {nearestCluster ? (
        <View style={styles.nearestBanner}>
          <Text style={styles.nearestBannerTitle}>{nearestCluster.title}</Text>
          <Text style={styles.nearestBannerMeta}>
            {(nearestCluster.priority_reasons ?? ["Live monitoring"])[0]} • ETA {nearestCluster.estimated_resolution_minutes ?? 90}m
          </Text>
        </View>
      ) : null}

      {/* Quick Action Buttons - Simplified */}
      <AnimatedCard delay={200}>
        <View style={styles.actionGrid}>
          <Pressable 
            style={styles.actionButton} 
            onPress={() => navigation.navigate("Report Fault")}
          >
            <Text style={styles.actionIcon}>📝</Text>
            <Text style={styles.actionText}>Report Issue</Text>
          </Pressable>
          <Pressable 
            style={styles.actionButton} 
            onPress={() => navigation.navigate("My Reports")}
          >
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionText}>My Reports</Text>
          </Pressable>
          <Pressable 
            style={[styles.actionButton, refreshing && styles.actionButtonRefreshing]}
            onPress={load}
            disabled={refreshing}
          >
            <Text style={[styles.actionIcon, refreshing && styles.actionIconSpinning]}>🔄</Text>
            <Text style={styles.actionText}>{refreshing ? "Updating..." : "Refresh"}</Text>
          </Pressable>
        </View>
      </AnimatedCard>

      {/* Map Section - Clickable to Expand */}
      <AnimatedCard delay={300}>
        <Pressable onPress={() => setMapExpandedModal(true)}>
          <View style={styles.mapSectionLabel}>
            <Text style={styles.mapTitle}>📍 Location Map</Text>
            <Text style={styles.mapSubtitle}>{activeNearby.length} issue{activeNearby.length !== 1 ? "s" : ""} • Tap to expand</Text>
          </View>

          <View style={styles.mapCard}>
            <MapView style={styles.map} region={region} scrollEnabled={false} zoomEnabled={false} provider={PROVIDER_GOOGLE}>
              {heatmapPoints.length ? (
                <Heatmap points={heatmapPoints} radius={40} opacity={0.5} />
              ) : null}
              {activeNearby.map((item) => (
                <Marker key={item.id} coordinate={{ latitude: item.latitude, longitude: item.longitude }} title={item.title} pinColor={item.utility_type === "electricity" ? "#f59e0b" : "#3b82f6"} />
              ))}
              {activeNearby.map((item) => (
                <Circle key={`circle-${item.id}`} center={{ latitude: item.latitude, longitude: item.longitude }} radius={Math.max(180, item.radius_meters ?? (item.report_count ?? 1) * 90)} strokeColor={item.utility_type === "electricity" ? "rgba(245, 158, 11, 0.7)" : "rgba(59, 130, 246, 0.7)"} fillColor={item.utility_type === "electricity" ? "rgba(245, 158, 11, 0.15)" : "rgba(59, 130, 246, 0.12)"} strokeWidth={2.5} />
              ))}
            </MapView>
            <View style={styles.mapExpandHint}>
              <Text style={styles.mapExpandText}>🔍 Tap to expand map</Text>
            </View>
          </View>
        </Pressable>
      </AnimatedCard>

      {/* Nearby Issues - Concise List */}
      {activeNearby.length > 0 && (
        <>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>📋 Nearby Issues</Text>
            <View style={styles.listHeaderRight}>
              <Text style={styles.listCount}>{activeNearby.length} found</Text>
              {activeNearby.length > 3 && (
                <Pressable onPress={() => setShowAllIssues(!showAllIssues)} style={styles.toggleButton}>
                  <Text style={styles.toggleText}>{showAllIssues ? "Collapse" : "View All"}</Text>
                </Pressable>
              )}
            </View>
          </View>
          <View style={styles.issueList}>
            {(showAllIssues ? activeNearby : activeNearby.slice(0, 3)).map((item, idx) => (
              <AnimatedCard key={item.id} delay={300 + idx * 100}>
                <View style={styles.issueCard}>
                  <View style={[styles.issueBadge, { backgroundColor: (item.priority_score ?? 0) >= 70 ? T.critical : (item.priority_score ?? 0) >= 40 ? T.warning : T.success }]}>
                    <Text style={styles.issueIcon}>{item.utility_type === "electricity" ? "⚡" : "💧"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.issueName} numberOfLines={1}>{item.title}</Text>
                    <View style={styles.issueInfo}>
                      <Text style={styles.issueDetail}>{item.report_count ?? 1} reports</Text>
                      <Text style={styles.issueDetail}>•</Text>
                      <Text style={styles.issueDetail}>{item.estimated_people?.toLocaleString() ?? "?"} affected</Text>
                      {item.estimated_resolution_minutes ? (
                        <>
                          <Text style={styles.issueDetail}>•</Text>
                          <Text style={styles.issueDetail}>ETA {item.estimated_resolution_minutes}m</Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <View style={[styles.priorityBadge, { backgroundColor: (item.priority_score ?? 0) >= 70 ? T.criticalLight : (item.priority_score ?? 0) >= 40 ? T.warningLight : T.successLight }]}>
                    <Text style={[styles.priorityText, { color: (item.priority_score ?? 0) >= 70 ? T.critical : (item.priority_score ?? 0) >= 40 ? T.warning : T.success }]}>
                      P{Math.round(item.priority_score ?? 0)}
                    </Text>
                  </View>
                </View>
              </AnimatedCard>
            ))}
          </View>
        </>
      )}

      {/* Expanded Map Modal */}
      <Modal visible={mapExpandedModal} transparent={false} animationType="fade">
        <View style={styles.expandedMapContainer}>
          <View style={styles.expandedMapHeader}>
            <Text style={styles.expandedMapTitle}>📍 Active Issues Map</Text>
            <Pressable onPress={() => setMapExpandedModal(false)} style={styles.closeMapButton}>
              <Text style={styles.closeMapText}>✕</Text>
            </Pressable>
          </View>

          <MapView style={styles.expandedMap} region={region} provider={PROVIDER_GOOGLE}>
            {heatmapPoints.length ? (
              <Heatmap points={heatmapPoints} radius={45} opacity={0.55} />
            ) : null}
            {activeNearby.map((item) => (
              <Marker key={item.id} coordinate={{ latitude: item.latitude, longitude: item.longitude }} title={item.title} pinColor={item.utility_type === "electricity" ? "#f59e0b" : "#3b82f6"} />
            ))}
            {activeNearby.map((item) => (
              <Circle key={`circle-${item.id}`} center={{ latitude: item.latitude, longitude: item.longitude }} radius={Math.max(180, item.radius_meters ?? (item.report_count ?? 1) * 90)} strokeColor={item.utility_type === "electricity" ? "rgba(245, 158, 11, 0.7)" : "rgba(59, 130, 246, 0.7)"} fillColor={item.utility_type === "electricity" ? "rgba(245, 158, 11, 0.15)" : "rgba(59, 130, 246, 0.12)"} strokeWidth={2.5} />
            ))}
          </MapView>

          <View style={styles.expandedMapInfo}>
            <View style={styles.expandedMapStats}>
              <View style={styles.expandedStatItem}>
                <Text style={styles.expandedStatIcon}>⚡</Text>
                <View>
                  <Text style={styles.expandedStatLabel}>Electricity</Text>
                  <Text style={styles.expandedStatValue}>{activeNearby.filter(i => i.utility_type === "electricity").length}</Text>
                </View>
              </View>
              <View style={styles.expandedStatDivider} />
              <View style={styles.expandedStatItem}>
                <Text style={styles.expandedStatIcon}>💧</Text>
                <View>
                  <Text style={styles.expandedStatLabel}>Water</Text>
                  <Text style={styles.expandedStatValue}>{activeNearby.filter(i => i.utility_type === "water").length}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { 
    paddingTop: 8, 
    paddingBottom: 24, 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center" 
  },
  greeting: { 
    fontSize: 13, 
    color: T.textSecondary, 
    fontWeight: "500", 
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  title: { 
    fontSize: 28, 
    fontWeight: "800", 
    color: T.text, 
    letterSpacing: -0.6,
  },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: T.primaryLight,
  },
  logoutText: {
    color: T.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  
  // Alert Card
  alertCard: {
    backgroundColor: T.primary,
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
    borderWidth: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  alertTop: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
    alignItems: "center",
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: T.white,
    marginBottom: 4,
  },
  alertDesc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "500",
  },
  alertStats: {
    flexDirection: "row",
    gap: 10,
  },
  statChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  statIcon: {
    fontSize: 18,
  },
  statText: {
    color: T.white,
    fontSize: 12,
    fontWeight: "700",
  },
  
  // Clear Card
  clearCard: {
    borderRadius: 18,
    padding: 32,
    marginBottom: 24,
    backgroundColor: T.successLight,
    alignItems: "center",
  },
  clearIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  clearTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: T.success,
    marginBottom: 4,
  },
  clearDesc: {
    fontSize: 13,
    color: T.textSecondary,
  },
  nearestBanner: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: 20,
  },
  nearestBannerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: T.text,
  },
  nearestBannerMeta: {
    fontSize: 12,
    color: T.textSecondary,
    marginTop: 6,
    fontWeight: "600",
  },
  
  // Action Grid
  actionGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  actionButtonRefreshing: {
    opacity: 0.7,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionIconSpinning: {
    opacity: 0.6,
  },
  actionText: {
    fontSize: 11,
    fontWeight: "700",
    color: T.text,
  },
  
  // Map Section
  mapSectionLabel: {
    marginBottom: 12,
  },
  mapTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: T.text,
    marginBottom: 2,
  },
  mapSubtitle: {
    fontSize: 12,
    color: T.textSecondary,
    fontWeight: "500",
  },
  mapCard: { 
    borderRadius: 16, 
    overflow: "hidden", 
    marginBottom: 28,
    borderWidth: 1,
    borderColor: T.border,
  },
  map: { 
    width: "100%", 
    height: 200,
  },
  mapExpandHint: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mapExpandText: {
    color: T.white,
    fontSize: 11,
    fontWeight: "700",
  },
  
  // List Section
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  listHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: T.text,
  },
  listCount: {
    fontSize: 12,
    color: T.textSecondary,
    fontWeight: "700",
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: T.electricSoft,
  },
  toggleText: {
    fontSize: 11,
    fontWeight: "800",
    color: T.electric,
  },
  issueList: {
    gap: 10,
    marginBottom: 24,
  },
  issueCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  issueBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: T.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  issueIcon: {
    fontSize: 20,
    fontWeight: "700",
    color: T.white,
  },
  issueName: {
    fontSize: 13,
    fontWeight: "700",
    color: T.text,
    marginBottom: 3,
  },
  issueInfo: {
    flexDirection: "row",
    gap: 4,
  },
  issueDetail: {
    fontSize: 11,
    color: T.textSecondary,
    fontWeight: "500",
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Expanded Map Modal
  expandedMapContainer: {
    flex: 1,
    backgroundColor: T.background,
    paddingTop: 20,
  },
  expandedMapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  expandedMapTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: T.text,
    letterSpacing: -0.4,
  },
  closeMapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.electricSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  closeMapText: {
    fontSize: 18,
    fontWeight: "800",
    color: T.electric,
  },
  expandedMap: {
    flex: 1,
  },
  expandedMapInfo: {
    padding: 18,
    backgroundColor: T.surface,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  expandedMapStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  expandedStatItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: T.background,
  },
  expandedStatIcon: {
    fontSize: 24,
  },
  expandedStatLabel: {
    fontSize: 11,
    color: T.textSecondary,
    fontWeight: "700",
  },
  expandedStatValue: {
    fontSize: 14,
    fontWeight: "800",
    color: T.text,
    marginTop: 2,
  },
  expandedStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: T.border,
  },
});
