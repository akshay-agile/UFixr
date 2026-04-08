import React, { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  estimated_resolution_minutes?: number | null;
  assignment_note?: string | null;
};

type Review = {
  rating: number;
  comment?: string;
  tags?: string[];
  created_at?: string;
};

type AvailabilityStatus = "unknown" | "available" | "unavailable" | "reschedule_requested";

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
  photo_urls?: string[];
  video_url?: string;
  video_urls?: string[];
  availability_status?: AvailabilityStatus;
  availability_note?: string;
  availability_windows?: string[];
  completion_code?: string;
  technician?: Technician | null;
  timeline?: TimelineEvent[];
  review?: Review | null;
  completion_confirmed_at?: string | null;
};

const FILTERS = ["All", "Pending", "Assigned", "In progress", "Resolved"] as const;
const AVAILABILITY_OPTIONS: { id: AvailabilityStatus; label: string }[] = [
  { id: "available", label: "Available" },
  { id: "unavailable", label: "Unavailable" },
  { id: "reschedule_requested", label: "Reschedule" },
];
const REVIEW_TAGS = ["On time", "Resolved issue", "Polite", "Clear updates"];

export default function MyReportsScreen() {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ReportItem[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [availabilityDrafts, setAvailabilityDrafts] = useState<Record<number, { status: AvailabilityStatus; note: string }>>({});
  const [completionCodes, setCompletionCodes] = useState<Record<number, string>>({});
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, { rating: number; comment: string; tags: string[] }>>({});

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

  const availabilityLabel = (status?: AvailabilityStatus) => {
    if (status === "available") return "Available";
    if (status === "unavailable") return "Unavailable";
    if (status === "reschedule_requested") return "Reschedule requested";
    return "Waiting for user update";
  };

  const updateAvailability = async (reportId: number) => {
    const draft = availabilityDrafts[reportId];
    if (!draft?.status || draft.status === "unknown") {
      Alert.alert("Choose availability", "Please tell dispatch whether someone will be available.");
      return;
    }
    try {
      await apiRequest(`/reports/${reportId}/availability`, {
        method: "PATCH",
        token,
        body: { availability_status: draft.status, availability_note: draft.note, availability_windows: [] },
      });
      await load();
    } catch (error) {
      Alert.alert("Update failed", error instanceof Error ? error.message : "Unknown error");
    }
  };

  const confirmResolution = async (reportId: number) => {
    try {
      await apiRequest(`/reports/${reportId}/confirm-resolution`, {
        method: "POST",
        token,
        body: { completion_code: completionCodes[reportId] ?? "" },
      });
      await load();
    } catch (error) {
      Alert.alert("Verification failed", error instanceof Error ? error.message : "Unknown error");
    }
  };

  const submitReview = async (reportId: number) => {
    const draft = reviewDrafts[reportId];
    if (!draft || draft.rating < 1) {
      Alert.alert("Add a rating", "Please rate the technician before submitting.");
      return;
    }
    try {
      await apiRequest(`/reports/${reportId}/review`, {
        method: "POST",
        token,
        body: { rating: draft.rating, comment: draft.comment, tags: draft.tags },
      });
      await load();
    } catch (error) {
      Alert.alert("Review failed", error instanceof Error ? error.message : "Unknown error");
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>My reports</Text>
          <Text style={styles.subtitle}>Track live progress, confirm availability, and verify completed work.</Text>
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
        const availabilityDraft = availabilityDrafts[item.id] ?? { status: item.availability_status ?? "unknown", note: item.availability_note ?? "" };
        const reviewDraft = reviewDrafts[item.id] ?? { rating: 5, comment: "", tags: [] };
        const estimatedResolution = item.technician?.estimated_resolution_minutes;
        const hasVideo = (item.video_urls?.length ?? 0) > 0 || Boolean(item.video_url);
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
                <View style={styles.miniMetaRow}>
                  <Text style={styles.miniMetaText}>ETA {item.technician?.eta_minutes ?? 45} min</Text>
                  <Text style={styles.miniMetaText}>Resolve in {estimatedResolution ?? "-"} min</Text>
                  <Text style={styles.miniMetaText}>{hasVideo ? "Video attached" : "Photo only"}</Text>
                </View>
                {item.technician && isExpanded ? (
                  <View style={styles.techCard}>
                    <Text style={styles.techTitle}>Assigned technician</Text>
                    <Text style={styles.techBody}>{item.technician.name} / {item.technician.rating.toFixed(1)} / {item.technician.phone}</Text>
                    <Text style={styles.techMeta}>{item.technician.zone} / ETA {item.technician.eta_minutes ?? 45} min / Resolution {estimatedResolution ?? "-"} min{item.technician.assignment_note ? ` / ${item.technician.assignment_note}` : ""}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {isExpanded ? (
              <View style={styles.expandedBody}>
                {item.status === "assigned" || item.status === "in_progress" ? (
                  <View style={styles.actionCard}>
                    <Text style={styles.sectionTitle}>Visit availability</Text>
                    <Text style={styles.sectionCopy}>{availabilityLabel(item.availability_status)}</Text>
                    <View style={styles.optionRow}>
                      {AVAILABILITY_OPTIONS.map((option) => {
                        const selected = availabilityDraft.status === option.id;
                        return (
                          <Pressable
                            key={option.id}
                            onPress={() => setAvailabilityDrafts((prev) => ({ ...prev, [item.id]: { ...availabilityDraft, status: option.id } }))}
                            style={[styles.optionChip, selected && styles.optionChipActive]}
                          >
                            <Text style={[styles.optionChipText, selected && styles.optionChipTextActive]}>{option.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <TextInput
                      value={availabilityDraft.note}
                      onChangeText={(text) => setAvailabilityDrafts((prev) => ({ ...prev, [item.id]: { ...availabilityDraft, note: text } }))}
                      placeholder="Gate locked, call me first, or ask to reschedule"
                      style={styles.input}
                    />
                    <Pressable style={styles.primaryButton} onPress={() => updateAvailability(item.id)}>
                      <Text style={styles.primaryButtonText}>Update availability</Text>
                    </Pressable>
                  </View>
                ) : null}

                {item.status === "resolved" ? (
                  <View style={styles.actionCard}>
                    <Text style={styles.sectionTitle}>Verified completion</Text>
                    <Text style={styles.sectionCopy}>Enter the service code shown to you by the technician to confirm the issue is truly resolved.</Text>
                    <Text style={styles.codeLabel}>Your verification code</Text>
                    <Text style={styles.codeValue}>{item.completion_code ?? "Pending"}</Text>
                    {!item.completion_confirmed_at ? (
                      <>
                        <TextInput
                          value={completionCodes[item.id] ?? ""}
                          onChangeText={(text) => setCompletionCodes((prev) => ({ ...prev, [item.id]: text }))}
                          placeholder="Enter completion code"
                          style={styles.input}
                        />
                        <Pressable style={styles.primaryButton} onPress={() => confirmResolution(item.id)}>
                          <Text style={styles.primaryButtonText}>Confirm resolution</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Text style={styles.successText}>Completion verified by you.</Text>
                    )}
                  </View>
                ) : null}

                {item.status === "resolved" && item.completion_confirmed_at ? (
                  <View style={styles.actionCard}>
                    <Text style={styles.sectionTitle}>Rate this technician</Text>
                    {item.review ? (
                      <Text style={styles.sectionCopy}>Verified review submitted: {item.review.rating}/5{item.review.comment ? ` - ${item.review.comment}` : ""}</Text>
                    ) : (
                      <>
                        <View style={styles.optionRow}>
                          {[1, 2, 3, 4, 5].map((rating) => {
                            const selected = reviewDraft.rating === rating;
                            return (
                              <Pressable
                                key={rating}
                                onPress={() => setReviewDrafts((prev) => ({ ...prev, [item.id]: { ...reviewDraft, rating } }))}
                                style={[styles.starChip, selected && styles.starChipActive]}
                              >
                                <Text style={[styles.starChipText, selected && styles.starChipTextActive]}>{rating}*</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <View style={styles.optionRow}>
                          {REVIEW_TAGS.map((tag) => {
                            const selected = reviewDraft.tags.includes(tag);
                            return (
                              <Pressable
                                key={tag}
                                onPress={() => setReviewDrafts((prev) => ({ ...prev, [item.id]: { ...reviewDraft, tags: selected ? reviewDraft.tags.filter((itemTag) => itemTag !== tag) : [...reviewDraft.tags, tag] } }))}
                                style={[styles.optionChip, selected && styles.optionChipActive]}
                              >
                                <Text style={[styles.optionChipText, selected && styles.optionChipTextActive]}>{tag}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <TextInput
                          value={reviewDraft.comment}
                          onChangeText={(text) => setReviewDrafts((prev) => ({ ...prev, [item.id]: { ...reviewDraft, comment: text } }))}
                          placeholder="Short feedback about the visit"
                          style={styles.input}
                        />
                        <Pressable style={styles.primaryButton} onPress={() => submitReview(item.id)}>
                          <Text style={styles.primaryButtonText}>Submit verified review</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                ) : null}

                {timeline.length > 0 ? (
                  <View style={styles.timelineWrap}>
                    <Text style={styles.timelineLabel}>Live issue tracking</Text>
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
              </View>
            ) : null}

            <View style={styles.cardFooter}>
              <Text style={styles.cardFooterText}>{new Date(item.created_at).toLocaleString()}</Text>
              <Text style={styles.cardFooterText}>{item.estimated_people?.toLocaleString() ?? "-"} people affected</Text>
            </View>
            {!isExpanded ? <Text style={styles.expandHint}>Tap for live tracking + actions</Text> : null}
          </Pressable>
        );
      })}
      <View style={{ height: Math.max(120, insets.bottom + 92) }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 12, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 12 },
  title: { fontSize: 26, fontWeight: "800", color: T.ink, letterSpacing: -1 },
  subtitle: { fontSize: 13, color: T.inkMuted, fontWeight: "300", marginTop: 4 },
  refreshBtn: { width: 40, height: 36, borderRadius: 11, backgroundColor: T.white, borderWidth: 1, borderColor: T.line, alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "flex-start" },
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
  miniMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  miniMetaText: { fontSize: 10, color: T.inkMuted, fontWeight: "600", backgroundColor: "#f7f4ef", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  techCard: { marginTop: 10, borderRadius: 14, padding: 12, backgroundColor: "#f8f7ff", borderWidth: 1, borderColor: "#e3ddff" },
  techTitle: { fontSize: 11, fontWeight: "700", color: "#5b35c8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  techBody: { fontSize: 12, fontWeight: "700", color: T.ink },
  techMeta: { fontSize: 11, color: T.inkMuted, marginTop: 4 },
  expandedBody: { paddingHorizontal: 14, paddingBottom: 12, gap: 12 },
  actionCard: { borderRadius: 16, padding: 14, borderWidth: 1, borderColor: T.line, backgroundColor: "#fcfbf8" },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: T.ink },
  sectionCopy: { marginTop: 6, fontSize: 11, color: T.inkMuted, lineHeight: 16 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  optionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: T.line, backgroundColor: T.white },
  optionChipActive: { backgroundColor: T.primary, borderColor: T.primary },
  optionChipText: { fontSize: 11, fontWeight: "700", color: T.inkMuted },
  optionChipTextActive: { color: T.white },
  input: { marginTop: 12, borderWidth: 1, borderColor: T.line, backgroundColor: T.white, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: T.ink },
  primaryButton: { marginTop: 12, backgroundColor: T.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  primaryButtonText: { color: T.white, fontSize: 12, fontWeight: "800" },
  codeLabel: { marginTop: 12, fontSize: 11, fontWeight: "700", color: T.inkMuted, textTransform: "uppercase", letterSpacing: 1 },
  codeValue: { marginTop: 4, fontSize: 22, fontWeight: "900", color: T.primary, letterSpacing: 3 },
  successText: { marginTop: 12, fontSize: 12, fontWeight: "700", color: "#0d5b3e" },
  starChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: T.line, backgroundColor: T.white },
  starChipActive: { backgroundColor: "#f59e0b", borderColor: "#f59e0b" },
  starChipText: { fontSize: 11, fontWeight: "800", color: T.inkMuted },
  starChipTextActive: { color: T.white },
  timelineWrap: { gap: 8 },
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
