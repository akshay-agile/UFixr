import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Screen from "../components/Screen";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

type TimelineEvent = {
  status: string;
  title: string;
  detail: string;
  created_at: string;
};

type Technician = {
  id: number;
  name: string;
  phone: string;
  rating: number;
  specialization: string;
  zone: string;
  eta_minutes?: number | null;
  assignment_note?: string | null;
};

type ReportItem = {
  id: number;
  title: string;
  utility_type: string;
  issue_type?: string;
  impact_level?: string;
  status: string;
  created_at: string;
  priority_score?: number;
  report_count?: number;
  estimated_people?: number;
  photo_url?: string;
  technician?: Technician | null;
  timeline?: TimelineEvent[];
};

const FILTERS = ["All", "Pending", "Assigned", "In progress", "Resolved"] as const;

export default function MyReportsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<ReportItem[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
    if (filter === "Pending") return item.status === "pending" || item.status === "acknowledged";
    if (filter === "Assigned") return item.status === "assigned";
    if (filter === "In progress") return item.status === "in_progress";
    return item.status === "resolved";
  });

  const statusStyle = (status: string) => {
    if (status === "resolved") return { bg: T.emeraldSoft, color: "#065c38", label: "Resolved" };
    if (status === "in_progress") return { bg: T.waterSoft, color: "#003f96", label: "In Progress" };
    if (status === "assigned") return { bg: "#ede9ff", color: "#5b35c8", label: "Assigned" };
    if (status === "acknowledged") return { bg: T.amberSoft, color: "#8a5c00", label: "Acknowledged" };
    return { bg: T.criticalSoft, color: "#8a0e0e", label: "Pending" };
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My reports</Text>
          <Text style={styles.subtitle}>Track report progress, assignment, and technician updates.</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={load}>
          <Text style={styles.refreshText}>RF</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabs}>
        {FILTERS.map((item) => (
          <Pressable key={item} style={[styles.filterTab, filter === item && styles.filterTabActive]} onPress={() => setFilter(item)}>
            <Text style={[styles.filterTabText, filter === item && styles.filterTabTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {filtered.map((item) => {
        const st = statusStyle(item.status);
        const timeline = item.timeline ?? [];
        const issueSummary = item.issue_type ? item.issue_type.replace(/_/g, " ") : item.utility_type;
        const isExpanded = expandedId === item.id;
        return (
          <Pressable
            key={item.id}
            style={[styles.card, isExpanded && styles.cardExpanded]}
            onPress={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
          >
            <View style={styles.cardTop}>
              <View style={[styles.cardIcon, { backgroundColor: item.utility_type === "water" ? T.waterSoft : T.electricSoft }]}>
                {item.photo_url ? <Image source={{ uri: item.photo_url }} style={styles.cardImage} /> : <Text style={{ fontSize: 15, fontWeight: "700" }}>{item.utility_type === "water" ? "WA" : "EL"}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                  <Text style={[styles.statusPillText, { color: st.color }]}>{st.label}</Text>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>{issueSummary} / Priority {Math.round(item.priority_score ?? 0)}% / {item.report_count ?? 1} reports nearby</Text>
                {item.technician && isExpanded ? (
                  <View style={styles.techCard}>
                    <Text style={styles.techTitle}>Assigned technician</Text>
                    <Text style={styles.techBody}>{item.technician.name} / {item.technician.rating.toFixed(1)} / {item.technician.phone}</Text>
                    <Text style={styles.techMeta}>{item.technician.zone} / ETA {item.technician.eta_minutes ?? 45} min{item.technician.assignment_note ? ` / ${item.technician.assignment_note}` : ""}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {isExpanded && timeline.length > 0 ? (
              <View style={styles.timelineWrap}>
                <Text style={styles.timelineLabel}>Status timeline</Text>
                {timeline.map((event, index) => (
                  <View key={`${item.id}-${index}`} style={styles.timelineRow}>
                    <View style={styles.timelineDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timelineTitle}>{event.title}</Text>
                      <Text style={styles.timelineDetail}>{event.detail}</Text>
                    </View>
                    <Text style={styles.timelineTime}>{new Date(event.created_at).toLocaleDateString()}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.cardFooter}>
              <Text style={styles.cardFooterText}>{new Date(item.created_at).toLocaleString()}</Text>
              <Text style={styles.cardFooterText}>{item.estimated_people?.toLocaleString() ?? "-"} people affected</Text>
            </View>
            { !isExpanded ? <Text style={styles.expandHint}>Tap for technician + timeline</Text> : null }
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 26, fontWeight: "800", color: T.ink, letterSpacing: -1 },
  subtitle: { fontSize: 13, color: T.inkMuted, fontWeight: "300", marginTop: 4 },
  refreshBtn: { width: 40, height: 36, borderRadius: 11, backgroundColor: T.white, borderWidth: 1, borderColor: T.line, alignItems: "center", justifyContent: "center" },
  refreshText: { fontSize: 12, fontWeight: "700", color: T.ink },
  filterTabs: { gap: 6, paddingBottom: 16 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: T.white, borderWidth: 1, borderColor: T.line },
  filterTabActive: { backgroundColor: T.primaryLight, borderColor: T.primary },
  filterTabText: { fontSize: 12, fontWeight: "600", color: T.inkMuted },
  filterTabTextActive: { color: T.primary, fontWeight: "700" },
  card: { backgroundColor: T.white, borderRadius: 20, borderWidth: 1, borderColor: T.line, overflow: "hidden", marginBottom: 12 },
  cardExpanded: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 4 },
  cardTop: { flexDirection: "row", gap: 12, padding: 14, alignItems: "flex-start" },
  cardIcon: { width: 58, height: 58, borderRadius: 14, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  cardImage: { width: "100%", height: "100%" },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, marginBottom: 5 },
  statusPillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  cardTitle: { fontSize: 13, fontWeight: "600", color: T.ink, marginBottom: 3, lineHeight: 18 },
  cardMeta: { fontSize: 11, color: T.inkMuted, fontWeight: "300", textTransform: "capitalize", lineHeight: 16 },
  techCard: { marginTop: 10, borderRadius: 14, padding: 12, backgroundColor: "#f8f7ff", borderWidth: 1, borderColor: "#e3ddff" },
  techTitle: { fontSize: 11, fontWeight: "700", color: "#5b35c8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  techBody: { fontSize: 12, fontWeight: "700", color: T.ink },
  techMeta: { fontSize: 11, color: T.inkMuted, marginTop: 4 },
  timelineWrap: { paddingHorizontal: 14, paddingBottom: 12, gap: 8 },
  timelineLabel: { fontSize: 11, fontWeight: "700", color: T.inkFaint, textTransform: "uppercase", letterSpacing: 1 },
  timelineRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", paddingVertical: 4 },
  timelineDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: T.electric, marginTop: 5 },
  timelineTitle: { fontSize: 12, fontWeight: "700", color: T.ink },
  timelineDetail: { fontSize: 11, color: T.inkMuted, marginTop: 2, lineHeight: 16 },
  timelineTime: { fontSize: 10, color: T.inkFaint },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(26,20,16,0.06)", backgroundColor: T.parchment },
  cardFooterText: { fontSize: 11, color: T.inkFaint, fontWeight: "300" },
  expandHint: { fontSize: 11, color: T.inkMuted, textAlign: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "rgba(26,20,16,0.05)", backgroundColor: "#fdfbf7" },
});
