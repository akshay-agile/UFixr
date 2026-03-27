import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

type ReportItem = {
  id: number;
  title: string;
  utility_type: string;
  status: string;
  created_at: string;
  priority_score?: number;
  report_count?: number;
  photo_url?: string;
};

const FILTERS = ["All", "Pending", "In progress", "Resolved"] as const;

export default function MyReportsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<ReportItem[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const load = async () => {
    try {
      const response = await apiRequest<{ items: ReportItem[] }>("/reports/me", { token });
      setItems(response.items);
    } catch (error) {
      Alert.alert("Load failed", error instanceof Error ? error.message : "Unknown error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = items.filter((item) => {
    if (filter === "All") return true;
    if (filter === "Pending") return item.status === "pending";
    if (filter === "In progress") return item.status === "in_progress";
    return item.status === "resolved";
  });

  const statusStyle = (status: string) => {
    if (status === "resolved") return { bg: T.emeraldSoft, color: "#065c38", label: "Resolved" };
    if (status === "in_progress") return { bg: T.waterSoft, color: "#003f96", label: "In Progress" };
    if (status === "acknowledged") return { bg: T.amberSoft, color: "#8a5c00", label: "Acknowledged" };
    return { bg: T.criticalSoft, color: "#8a0e0e", label: "Pending" };
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My reports</Text>
          <Text style={styles.subtitle}>Track your submitted reports and crew progress.</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={load}>
          <Text style={styles.refreshText}>R</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabs}>
        {FILTERS.map((item) => (
          <Pressable
            key={item}
            style={[styles.filterTab, filter === item && styles.filterTabActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.filterTabText, filter === item && styles.filterTabTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {filtered.map((item) => {
        const st = statusStyle(item.status);
        return (
          <View style={styles.card} key={item.id}>
            <View style={styles.cardTop}>
              <View style={[styles.cardIcon, { backgroundColor: item.utility_type === "water" ? T.waterSoft : T.electricSoft }]}>
                {item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.cardImage} /> : <Text style={{ fontSize: 24 }}>{item.utility_type === "water" ? "W" : "E"}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                  <Text style={[styles.statusPillText, { color: st.color }]}>{st.label}</Text>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>{item.utility_type} · Priority {Math.round(item.priority_score ?? 0)}% · {item.report_count ?? 1} reports nearby</Text>
              </View>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.cardFooterText}>{new Date(item.created_at).toLocaleString()}</Text>
              <Text style={styles.cardFooterText}>Live status tracking</Text>
            </View>
          </View>
        );
      })}
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
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: T.ink,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 13,
    color: T.inkMuted,
    fontWeight: "300",
    marginTop: 4,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: T.white,
    borderWidth: 1,
    borderColor: T.line,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshText: {
    fontSize: 16,
    color: T.ink,
  },
  filterTabs: {
    gap: 6,
    paddingBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: T.white,
    borderWidth: 1,
    borderColor: T.line,
  },
  filterTabActive: {
    backgroundColor: T.ink,
    borderColor: T.ink,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: T.inkMuted,
  },
  filterTabTextActive: {
    color: T.white,
  },
  card: {
    backgroundColor: T.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.line,
    overflow: "hidden",
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    alignItems: "flex-start",
  },
  cardIcon: {
    width: 58,
    height: 58,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 5,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: T.ink,
    marginBottom: 3,
    lineHeight: 18,
  },
  cardMeta: {
    fontSize: 11,
    color: T.inkMuted,
    fontWeight: "300",
    textTransform: "capitalize",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(26,20,16,0.06)",
    backgroundColor: T.parchment,
  },
  cardFooterText: {
    fontSize: 11,
    color: T.inkFaint,
    fontWeight: "300",
  },
});


