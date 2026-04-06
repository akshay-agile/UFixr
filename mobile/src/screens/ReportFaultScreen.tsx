
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import LiveClusterMap, { LiveClusterPoint } from "../components/LiveClusterMap";
import SkeletonLoader from "../components/SkeletonLoader";
import SuccessModal from "../components/SuccessModal";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";

type SuggestedCluster = { id: number; title: string; status: string; report_count: number; priority_score: number; distance_meters: number; estimated_resolution_minutes?: number; priority_reasons?: string[]; radius_meters?: number; };
type TechnicianOption = { id: number; name: string; phone: string; rating: number; specialization: string; zone: string; };
type ClusterVisual = LiveClusterPoint & { priority_reasons?: string[]; report_count?: number; };
type UtilityType = "electricity" | "water";
type ImpactLevel = "just_me" | "few_homes" | "whole_street" | "dangerous_emergency";
type IssueOption = { id: string; label: string; desc: string; icon: string; };

type Palette = ReturnType<typeof createPalette>;
const STORAGE_KEYS = { utility: "reportFault:lastUtility", impact: "reportFault:lastImpact", issueElectricity: "reportFault:lastIssue:electricity", issueWater: "reportFault:lastIssue:water" };
const MAX_PHOTOS = 4;
const MAX_NOTE_LENGTH = 240;
const IMAGE_MEDIA_TYPE: ImagePicker.MediaType = "images";
const UTILITY_OPTIONS: { id: UtilityType; label: string; icon: string; desc: string }[] = [
  { id: "electricity", label: "Electricity", icon: "\u26A1", desc: "Outages, sparks, streetlights" },
  { id: "water", label: "Water", icon: "\uD83D\uDCA7", desc: "Leaks, supply, contamination" },
];
const ISSUE_OPTIONS: Record<UtilityType, IssueOption[]> = {
  electricity: [
    { id: "no_power", label: "No power", desc: "Complete outage at home or building", icon: "\u26A1" },
    { id: "flickering", label: "Flickering power", desc: "Intermittent voltage or unstable lights", icon: "\uD83D\uDCA1" },
    { id: "spark_smell", label: "Sparks or burning smell", desc: "Potential fire risk nearby", icon: "\uD83D\uDD25" },
    { id: "dangerous_wire", label: "Loose wire", desc: "Pole or cable hazard in public space", icon: "\uD83D\uDEA7" },
    { id: "streetlight", label: "Streetlight issue", desc: "Lighting outage in a public area", icon: "\uD83C\uDF19" },
  ],
  water: [
    { id: "no_supply", label: "No water", desc: "Supply has stopped completely", icon: "\uD83D\uDEB1" },
    { id: "low_pressure", label: "Low pressure", desc: "Water is coming in weakly", icon: "\uD83E\uDEE7" },
    { id: "leakage", label: "Water leak", desc: "Visible leak from pipe or line", icon: "\uD83D\uDCA7" },
    { id: "dirty_water", label: "Dirty water", desc: "Unsafe color, smell, or contamination", icon: "\uD83E\uDDEA" },
    { id: "burst_pipe", label: "Burst pipe", desc: "Flooding or major water loss", icon: "\uD83C\uDF0A" },
  ],
};
const IMPACT_OPTIONS: { id: ImpactLevel; label: string; shortLabel: string; icon: string; color: string; desc: string }[] = [
  { id: "just_me", label: "Home", shortLabel: "Home", icon: "\uD83C\uDFE0", color: "#16a34a", desc: "Just my home or apartment" },
  { id: "few_homes", label: "Few Houses", shortLabel: "Few", icon: "\uD83C\uDFD8", color: "#d97706", desc: "A small pocket nearby" },
  { id: "whole_street", label: "Area", shortLabel: "Area", icon: "\uD83C\uDFD9", color: "#ea580c", desc: "Whole street or neighborhood" },
  { id: "dangerous_emergency", label: "Emergency", shortLabel: "Emergency", icon: "\uD83D\uDEA8", color: "#dc2626", desc: "Immediate safety risk" },
];
const SEVERITY_STEPS = [
  { value: 1, emoji: "\uD83D\uDE0C", label: "Calm", feedback: "Low urgency - logging for follow-up" },
  { value: 2, emoji: "\uD83D\uDC40", label: "Watch", feedback: "Worth monitoring - likely routine" },
  { value: 3, emoji: "\u26A0\uFE0F", label: "Elevated", feedback: "Elevated priority - review soon" },
  { value: 4, emoji: "\uD83D\uDD25", label: "High", feedback: "High priority - dispatch recommended" },
  { value: 5, emoji: "\uD83D\uDEA8", label: "Critical", feedback: "Critical priority - immediate escalation" },
] as const;

function createPalette(isDark: boolean) {
  return isDark
    ? { screen: "#0b1020", card: "rgba(16,23,42,0.76)", elevated: "#131c31", border: "rgba(148,163,184,0.18)", text: "#f8fafc", textMuted: "#a7b4cc", textFaint: "#7f8aa3", primary: "#7c8cff", primaryStrong: "#5a67ff", primarySoft: "rgba(124,140,255,0.18)", secondarySoft: "rgba(56,189,248,0.14)", shadow: "#020617", heroTop: "rgba(91,92,240,0.32)", heroBottom: "rgba(31,123,255,0.18)", successSoft: "rgba(34,197,94,0.16)", warningSoft: "rgba(245,158,11,0.18)", dangerSoft: "rgba(220,38,38,0.18)", input: "rgba(15,23,42,0.78)", mapOverlay: "rgba(11,16,32,0.7)", ctaText: "#fff" }
    : { screen: "#f5f7fb", card: "rgba(255,255,255,0.82)", elevated: "#fff", border: "rgba(148,163,184,0.18)", text: "#0f172a", textMuted: "#52607a", textFaint: "#8692a6", primary: "#4f46e5", primaryStrong: "#2563eb", primarySoft: "rgba(79,70,229,0.1)", secondarySoft: "rgba(37,99,235,0.08)", shadow: "#1e293b", heroTop: "rgba(79,70,229,0.15)", heroBottom: "rgba(37,99,235,0.08)", successSoft: "rgba(34,197,94,0.12)", warningSoft: "rgba(245,158,11,0.14)", dangerSoft: "rgba(220,38,38,0.12)", input: "rgba(255,255,255,0.92)", mapOverlay: "rgba(255,255,255,0.72)", ctaText: "#fff" };
}
function derivedSeverity(utilityType: UtilityType, issueType: string, impactLevel: ImpactLevel) {
  const baseMap: Record<UtilityType, Record<string, number>> = { electricity: { no_power: 4, flickering: 3, spark_smell: 5, dangerous_wire: 5, streetlight: 2 }, water: { no_supply: 4, low_pressure: 2, leakage: 3, dirty_water: 4, burst_pipe: 5 } };
  const impactBonus: Record<ImpactLevel, number> = { just_me: 0, few_homes: 0, whole_street: 1, dangerous_emergency: 1 };
  return Math.min((baseMap[utilityType][issueType] ?? 3) + impactBonus[impactLevel], 5);
}
function formatLocationLabel(coords: { latitude: number; longitude: number } | null) { return coords ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : "Detecting current location"; }
function findSuggestedIssueId(utilityType: UtilityType, clusterTitle?: string) {
  if (!clusterTitle) return null;
  const title = clusterTitle.toLowerCase();
  return ISSUE_OPTIONS[utilityType].find((option) => title.includes(option.label.toLowerCase()) || title.includes(option.id.replace(/_/g, " ")) )?.id ?? null;
}
function buildInsight(args: { topCluster: SuggestedCluster | null; impactLevel: ImpactLevel; severityValue: number; utilityType: UtilityType; }) {
  const { topCluster, impactLevel, severityValue, utilityType } = args;
  if (topCluster) {
    const clusterType = impactLevel === "whole_street" || impactLevel === "dangerous_emergency" ? "Area Spread" : "Local Cluster";
    const confidence = Math.min(98, Math.max(72, Math.round(topCluster.priority_score)));
    return { tone: severityValue >= 4 ? "danger" : "primary", title: `${utilityType === "electricity" ? "\u26A1" : "\uD83D\uDCA7"} Based on your inputs, this is a ${clusterType} Issue`, body: `${topCluster.report_count} nearby report${topCluster.report_count === 1 ? "" : "s"} within ${topCluster.distance_meters}m suggest this may already be active in your area.`, confidence };
  }
  return { tone: severityValue >= 4 ? "warning" : "success", title: `${utilityType === "electricity" ? "\u26A1" : "\uD83D\uDCA7"} This looks like a fresh report signal`, body: "No strong nearby cluster was found yet, so your report may help create the first verified signal for dispatch.", confidence: severityValue >= 4 ? 82 : 68 };
}
function SectionHeader({ eyebrow, title, subtitle, palette, onLayout }: { eyebrow: string; title: string; subtitle?: string; palette: Palette; onLayout?: (y: number) => void; }) {
  return <View onLayout={(e) => onLayout?.(e.nativeEvent.layout.y)} style={styles.sectionHeader}><Text style={[styles.sectionEyebrow, { color: palette.primary }]}>{eyebrow}</Text><Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>{subtitle ? <Text style={[styles.sectionSubtitle, { color: palette.textMuted }]}>{subtitle}</Text> : null}</View>;
}
function SeverityControl({ value, autoValue, manual, onChange, onReset, palette }: { value: number; autoValue: number; manual: boolean; onChange: (next: number) => void; onReset: () => void; palette: Palette; }) {
  const selectedStep = SEVERITY_STEPS.find((step) => step.value === value) ?? SEVERITY_STEPS[2];
  return (
    <View style={[styles.glassCard, { backgroundColor: palette.card, borderColor: palette.border, shadowColor: palette.shadow }]}>
      <View style={styles.severityTopRow}><View><Text style={[styles.severityEmoji, { color: palette.text }]}>{selectedStep.emoji} {selectedStep.label}</Text><Text style={[styles.severityFeedback, { color: palette.textMuted }]}>{selectedStep.feedback}</Text></View>{manual ? <Pressable onPress={onReset} style={[styles.inlineChip, { backgroundColor: palette.primarySoft }]}><Text style={[styles.inlineChipText, { color: palette.primary }]}>Auto S{autoValue}</Text></Pressable> : <View style={[styles.inlineChip, { backgroundColor: palette.secondarySoft }]}><Text style={[styles.inlineChipText, { color: palette.primaryStrong }]}>Smart default</Text></View>}</View>
      <View style={styles.severitySegmentRow}>{SEVERITY_STEPS.map((step) => { const selected = step.value === value; return <Pressable key={step.value} onPress={() => onChange(step.value)} style={[styles.severitySegment, { backgroundColor: selected ? palette.primaryStrong : palette.elevated, borderColor: selected ? palette.primaryStrong : palette.border }]}><Text style={[styles.severitySegmentEmoji, { opacity: selected ? 1 : 0.8 }]}>{step.emoji}</Text><Text style={[styles.severitySegmentLabel, { color: selected ? palette.ctaText : palette.text }]}>{step.label}</Text></Pressable>; })}</View>
    </View>
  );
}

export default function ReportFaultScreen() {
  const { token } = useAuth();
  const scheme = useColorScheme();
  const palette = useMemo(() => createPalette(scheme === "dark"), [scheme]);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  const insightAnim = useRef(new Animated.Value(0)).current;
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [utilityType, setUtilityType] = useState<UtilityType>("electricity");
  const [issueType, setIssueType] = useState<string>(ISSUE_OPTIONS.electricity[0].id);
  const [impactLevel, setImpactLevel] = useState<ImpactLevel>("few_homes");
  const [description, setDescription] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState("Detecting current location");
  const [refreshingLocation, setRefreshingLocation] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestedClusters, setSuggestedClusters] = useState<SuggestedCluster[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [joinClusterId, setJoinClusterId] = useState<number | null>(null);
  const [preferredTechnicianId, setPreferredTechnicianId] = useState<number | null>(null);
  const [customIssue, setCustomIssue] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [manualSeverity, setManualSeverity] = useState(false);
  const [severityValue, setSeverityValue] = useState(() => derivedSeverity("electricity", ISSUE_OPTIONS.electricity[0].id, "few_homes"));
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [clusterVisuals, setClusterVisuals] = useState<ClusterVisual[]>([]);
  const [clusterMapLoading, setClusterMapLoading] = useState(true);
  const [showAllIssues, setShowAllIssues] = useState(false);
  const remainingPhotoSlots = Math.max(0, MAX_PHOTOS - photoUris.length);
  const visibleIssueOptions = showAllIssues ? ISSUE_OPTIONS[utilityType] : ISSUE_OPTIONS[utilityType].slice(0, 4);
  const derivedSeverityScore = useMemo(() => derivedSeverity(utilityType, issueType, impactLevel), [impactLevel, issueType, utilityType]);
  const issueLabel = issueType.startsWith("custom_") ? customIssue || "Custom issue" : ISSUE_OPTIONS[utilityType].find((item) => item.id === issueType)?.label ?? "Issue";
  const topCluster = suggestedClusters[0] ?? null;
  const suggestedIssueId = useMemo(() => findSuggestedIssueId(utilityType, topCluster?.title), [topCluster?.title, utilityType]);
  const severityStep = SEVERITY_STEPS.find((step) => step.value === severityValue) ?? SEVERITY_STEPS[2];
  const insight = useMemo(() => buildInsight({ topCluster, impactLevel, severityValue, utilityType }), [impactLevel, severityValue, topCluster, utilityType]);
  const clusterMapRegion = useMemo(() => location ? { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 } : undefined, [location]);
  const noteCount = description.length;
  const registerSection = (key: string) => (y: number) => { sectionOffsets.current[key] = y; };
  const scrollToSection = (key: string) => { const y = sectionOffsets.current[key]; if (typeof y === "number") scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true }); };

  useEffect(() => { (async () => {
    try {
      const defaults = await AsyncStorage.multiGet([STORAGE_KEYS.utility, STORAGE_KEYS.impact, STORAGE_KEYS.issueElectricity, STORAGE_KEYS.issueWater]);
      const map = Object.fromEntries(defaults);
      const nextUtility = map[STORAGE_KEYS.utility] === "water" ? "water" : "electricity";
      const nextImpact = IMPACT_OPTIONS.some((item) => item.id === map[STORAGE_KEYS.impact]) ? (map[STORAGE_KEYS.impact] as ImpactLevel) : "few_homes";
      const storedIssue = nextUtility === "water" ? map[STORAGE_KEYS.issueWater] : map[STORAGE_KEYS.issueElectricity];
      const fallbackIssue = ISSUE_OPTIONS[nextUtility][0].id;
      const nextIssue = ISSUE_OPTIONS[nextUtility].some((item) => item.id === storedIssue) ? (storedIssue as string) : fallbackIssue;
      setUtilityType(nextUtility); setImpactLevel(nextImpact); setIssueType(nextIssue); setSeverityValue(derivedSeverity(nextUtility, nextIssue, nextImpact));
    } catch (error) { console.warn("Failed to load report defaults", error); }
  })(); }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEYS.utility, utilityType).catch(() => undefined);
    AsyncStorage.setItem(STORAGE_KEYS.impact, impactLevel).catch(() => undefined);
    const key = utilityType === "water" ? STORAGE_KEYS.issueWater : STORAGE_KEYS.issueElectricity;
    if (!issueType.startsWith("custom_")) AsyncStorage.setItem(key, issueType).catch(() => undefined);
  }, [impactLevel, issueType, utilityType]);

  useEffect(() => { if (!manualSeverity) setSeverityValue(derivedSeverityScore); }, [derivedSeverityScore, manualSeverity]);
  useEffect(() => { setShowAllIssues(false); setJoinClusterId(null); }, [utilityType]);
  useEffect(() => { Animated.spring(insightAnim, { toValue: 1, useNativeDriver: true, damping: 16, stiffness: 180 }).start(); }, [insight, insightAnim]);
  useEffect(() => {
    const makeLoop = (value: Animated.Value, delay: number) => Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(value, { toValue: 1, duration: 1800, useNativeDriver: true }), Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true })]));
    const loopA = makeLoop(pulseA, 0); const loopB = makeLoop(pulseB, 600); loopA.start(); loopB.start();
    return () => { loopA.stop(); loopB.stop(); };
  }, [pulseA, pulseB]);
  useEffect(() => { refreshLocation(); }, []);
  useEffect(() => { fetchSuggestions(); }, [utilityType]);
  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current); }, []);

  const appendPhotoAssets = (assets: ImagePicker.ImagePickerAsset[] | undefined) => {
    if (!assets?.length) return;
    setPhotoUris((prev) => {
      const available = MAX_PHOTOS - prev.length; if (available <= 0) return prev;
      const next = assets.filter((asset) => asset?.uri).slice(0, available).map((asset) => asset.uri);
      return next.length ? [...prev, ...next] : prev;
    });
  };
  const removePhoto = (uri: string) => setPhotoUris((prev) => prev.filter((item) => item !== uri));

  async function refreshLocation(silent = false) {
    try {
      if (!silent) setRefreshingLocation(true);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") { setLocationLabel("Location access needed"); return null; }
      const current = await Location.getCurrentPositionAsync({});
      const coords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      setLocation(coords); setLocationLabel(formatLocationLabel(coords)); return coords;
    } catch (error) {
      console.warn("Location refresh failed", error);
      if (!silent) Alert.alert("Location unavailable", "We could not refresh your current location right now.");
      return null;
    } finally { if (!silent) setRefreshingLocation(false); }
  }

  async function loadClusterVisuals(coords: { latitude: number; longitude: number }) {
    try {
      setClusterMapLoading(true);
      const response = await apiRequest<{ items: ClusterVisual[] }>(`/reports/nearby?latitude=${coords.latitude}&longitude=${coords.longitude}`, { token });
      setClusterVisuals((response.items ?? []).map((item) => ({ ...item, radius_meters: item.radius_meters ?? Math.max(180, (item.report_count ?? 1) * 90) })));
    } catch (error) { console.warn("Cluster map load failed", error); } finally { setClusterMapLoading(false); }
  }

  async function fetchSuggestions(coords?: { latitude: number; longitude: number }) {
    try {
      setLoadingSuggestions(true);
      let currentCoords = coords ?? location;
      if (!currentCoords) currentCoords = await refreshLocation(true);
      if (!currentCoords) { setLoadingSuggestions(false); return; }
      const response = await apiRequest<{ clusters: SuggestedCluster[]; technicians: TechnicianOption[] }>(`/reports/suggestions?utility_type=${utilityType}&latitude=${currentCoords.latitude}&longitude=${currentCoords.longitude}`, { token });
      const clusters = response.clusters ?? [];
      setSuggestedClusters(clusters); setTechnicians(response.technicians ?? []);
      if (clusters.length > 0 && clusters[0].distance_meters <= 500) setJoinClusterId((prev) => prev ?? clusters[0].id); else setJoinClusterId(null);
      if ((response.technicians ?? []).length > 0 && !preferredTechnicianId) setPreferredTechnicianId(response.technicians[0].id);
      await loadClusterVisuals(currentCoords);
    } catch (error) { Alert.alert("Suggestion check failed", error instanceof Error ? error.message : "Unknown error"); } finally { setLoadingSuggestions(false); }
  }

  const pickImage = async () => {
    if (remainingPhotoSlots <= 0) return Alert.alert("Limit reached", `You can attach up to ${MAX_PHOTOS} photos.`);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission needed", "Please allow photo library access.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: IMAGE_MEDIA_TYPE, allowsMultipleSelection: true, selectionLimit: Math.max(1, remainingPhotoSlots), quality: 0.75 });
    if (!result.canceled) appendPhotoAssets(result.assets);
  };
  const takePicture = async () => {
    if (remainingPhotoSlots <= 0) return Alert.alert("Limit reached", `You can attach up to ${MAX_PHOTOS} photos.`);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission needed", "Please allow camera access.");
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: IMAGE_MEDIA_TYPE, allowsEditing: false, quality: 0.75 });
    if (!result.canceled) appendPhotoAssets(result.assets);
  };
  const onUseQuickTag = (tag: "no_power" | "leakage" | "dangerous_emergency") => {
    if (tag === "leakage") { setUtilityType("water"); setIssueType("leakage"); setImpactLevel("few_homes"); }
    else if (tag === "dangerous_emergency") { setImpactLevel("dangerous_emergency"); setIssueType(utilityType === "water" ? "burst_pipe" : "dangerous_wire"); }
    else { setUtilityType("electricity"); setIssueType("no_power"); setImpactLevel("few_homes"); }
    setTimeout(() => scrollToSection("utility"), 120);
  };
  const onCustomIssueConfirm = () => { if (!customIssue.trim()) return; setIssueType(`custom_${Date.now()}`); setShowCustomModal(false); setTimeout(() => scrollToSection("impact"), 120); };

  const onSubmit = async () => {
    if (submitting) return;
    try {
      setSubmitting(true);
      const coords = (await refreshLocation(true)) ?? location;
      if (!coords) { Alert.alert("Location required", "Please allow location access for accurate reporting."); setSubmitting(false); return; }
      const uploadedPhotoUrls: string[] = [];
      for (let index = 0; index < photoUris.length; index += 1) {
        const uri = photoUris[index]; if (!uri) continue;
        const form = new FormData(); form.append("file", { uri, name: `fault-photo-${index + 1}.jpg`, type: "image/jpeg" } as any);
        const uploadResponse = await apiRequest<{ photo_url: string }>("/upload", { method: "POST", body: form, isFormData: true });
        if (uploadResponse.photo_url) uploadedPhotoUrls.push(uploadResponse.photo_url);
      }
      await apiRequest("/reports", { method: "POST", token, body: { utility_type: utilityType, issue_type: issueType, impact_level: impactLevel, title: `${issueLabel} / ${IMPACT_OPTIONS.find((item) => item.id === impactLevel)?.label ?? "Impact"}`, description, latitude: coords.latitude, longitude: coords.longitude, photo_urls: uploadedPhotoUrls, join_cluster_id: joinClusterId, preferred_technician_id: preferredTechnicianId, severity: severityValue } });
      setDescription(""); setPhotoUris([]); setManualSeverity(false); setImpactLevel("few_homes"); setJoinClusterId(null); setShowSuccessModal(true);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setShowSuccessModal(false), 2200);
      await fetchSuggestions(coords);
    } catch (error) { Alert.alert("Submission failed", error instanceof Error ? error.message : "Unknown error"); } finally { setSubmitting(false); }
  };

  const impactMeta = IMPACT_OPTIONS.find((item) => item.id === impactLevel) ?? IMPACT_OPTIONS[1];
  const clusterMessage = clusterVisuals.length > 0 ? `${clusterVisuals.length} report${clusterVisuals.length === 1 ? "" : "s"} within 500m` : "No nearby reports yet";
  const joinCluster = suggestedClusters.find((cluster) => cluster.id === joinClusterId) ?? null;
  const pulseStyleA = { opacity: pulseA.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.75, 0.2, 0] }), transform: [{ scale: pulseA.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.7] }) }] };
  const pulseStyleB = { opacity: pulseB.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.75, 0.2, 0] }), transform: [{ scale: pulseB.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.7] }) }] };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.screen }]} edges={["top", "left", "right"]}>
      <View style={styles.screenWrap}>
        <ScrollView ref={scrollRef} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 132 }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border, shadowColor: palette.shadow }]}>
            <View style={[styles.heroGlow, { backgroundColor: palette.heroTop }]} /><View style={[styles.heroGlowSecondary, { backgroundColor: palette.heroBottom }]} />
            <View style={styles.heroTopRow}><View style={[styles.heroIconWrap, { backgroundColor: palette.primarySoft }]}><Text style={styles.heroIcon}>{"\uD83D\uDEE0"}</Text></View><View style={styles.heroTextWrap}><Text style={[styles.heroTitle, { color: palette.text }]}>Report Issue</Text><Text style={[styles.heroSubtitle, { color: palette.textMuted }]}>Tell us what&apos;s wrong in seconds</Text></View></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickChipRow}>{[{ key: "no_power", label: "\u26A1 No Power" }, { key: "leakage", label: "\uD83D\uDCA7 Water Leak" }, { key: "dangerous_emergency", label: "\uD83D\uDEA8 Emergency" }].map((chip) => <Pressable key={chip.key} onPress={() => onUseQuickTag(chip.key as "no_power" | "leakage" | "dangerous_emergency")} style={[styles.quickChip, { backgroundColor: palette.elevated, borderColor: palette.border }]}><Text style={[styles.quickChipText, { color: palette.text }]}>{chip.label}</Text></Pressable>)}</ScrollView>
            <View style={styles.heroMetaRow}><View style={[styles.metaPill, { backgroundColor: palette.secondarySoft }]}><Text style={[styles.metaPillText, { color: palette.primaryStrong }]}>{joinCluster ? `Matched nearby cluster #${joinCluster.id}` : "Fresh signal"}</Text></View><View style={[styles.metaPill, { backgroundColor: palette.primarySoft }]}><Text style={[styles.metaPillText, { color: palette.primary }]}>{severityStep.label} priority</Text></View></View>
          </View>

          <SectionHeader eyebrow="Utility" title="Start with the service" subtitle="We remember your last selection to speed this up." palette={palette} onLayout={registerSection("utility")} />
          <View style={[styles.glassCard, { backgroundColor: palette.card, borderColor: palette.border, shadowColor: palette.shadow }]}><View style={styles.utilitySelectorRow}>{UTILITY_OPTIONS.map((option) => { const selected = option.id === utilityType; return <Pressable key={option.id} onPress={() => { setUtilityType(option.id); setIssueType(ISSUE_OPTIONS[option.id][0].id); setTimeout(() => scrollToSection("issue"), 120); }} style={[styles.utilityPill, { backgroundColor: selected ? palette.primary : palette.elevated, borderColor: selected ? palette.primaryStrong : palette.border, shadowColor: selected ? palette.primary : palette.shadow, transform: [{ scale: selected ? 1.02 : 1 }] }]}><Text style={styles.utilityPillIcon}>{option.icon}</Text><Text style={[styles.utilityPillTitle, { color: selected ? palette.ctaText : palette.text }]}>{option.label}</Text><Text style={[styles.utilityPillDesc, { color: selected ? "rgba(255,255,255,0.8)" : palette.textMuted }]}>{option.desc}</Text></Pressable>; })}</View></View>

          <SectionHeader eyebrow="Issue Type" title="What best describes the issue?" subtitle="Most people only need one of these." palette={palette} onLayout={registerSection("issue")} />
          <View style={styles.issueGrid}>
            {visibleIssueOptions.map((option) => { const selected = option.id === issueType; const suggested = suggestedIssueId === option.id; return <Pressable key={option.id} onPress={() => { setIssueType(option.id); setTimeout(() => scrollToSection("impact"), 120); }} style={[styles.issueCard, { backgroundColor: palette.card, borderColor: selected ? palette.primaryStrong : palette.border, shadowColor: selected ? palette.primary : palette.shadow }]}><View style={styles.issueCardTopRow}><View style={[styles.issueIconWrap, { backgroundColor: selected ? palette.primarySoft : palette.secondarySoft }]}><Text style={styles.issueIcon}>{option.icon}</Text></View>{suggested ? <View style={[styles.badge, { backgroundColor: palette.warningSoft }]}><Text style={[styles.badgeText, { color: "#b45309" }]}>Most common nearby</Text></View> : null}</View><Text style={[styles.issueTitle, { color: palette.text }]}>{option.label}</Text><Text style={[styles.issueDesc, { color: palette.textMuted }]}>{option.desc}</Text></Pressable>; })}
            <Pressable onPress={() => setShowCustomModal(true)} style={[styles.issueCard, { backgroundColor: palette.card, borderColor: issueType.startsWith("custom_") ? palette.primaryStrong : palette.border, shadowColor: palette.shadow }]}><View style={styles.issueCardTopRow}><View style={[styles.issueIconWrap, { backgroundColor: palette.secondarySoft }]}><Text style={styles.issueIcon}>{"\u270D\uFE0F"}</Text></View></View><Text style={[styles.issueTitle, { color: palette.text }]}>Custom issue</Text><Text style={[styles.issueDesc, { color: palette.textMuted }]} numberOfLines={2}>{customIssue || "Describe something that does not fit the presets."}</Text></Pressable>
          </View>
          {ISSUE_OPTIONS[utilityType].length > 4 ? <Pressable onPress={() => setShowAllIssues((prev) => !prev)} style={styles.seeMoreWrap}><Text style={[styles.seeMoreText, { color: palette.primary }]}>{showAllIssues ? "See less" : "See more issue types"}</Text></Pressable> : null}

          <SectionHeader eyebrow="Impact" title="How far does this affect people?" subtitle="Choose the reach, and we&apos;ll tune the urgency automatically." palette={palette} onLayout={registerSection("impact")} />
          <View style={[styles.glassCard, { backgroundColor: palette.card, borderColor: palette.border, shadowColor: palette.shadow }]}><View style={styles.impactRow}>{IMPACT_OPTIONS.map((option) => { const selected = option.id === impactLevel; return <Pressable key={option.id} onPress={() => { setImpactLevel(option.id); setTimeout(() => scrollToSection("severity"), 120); }} style={[styles.impactPill, { backgroundColor: selected ? option.color : palette.elevated, borderColor: selected ? option.color : palette.border }]}><Text style={styles.impactIcon}>{option.icon}</Text><Text style={[styles.impactLabel, { color: selected ? "#fff" : palette.text }]}>{option.shortLabel}</Text></Pressable>; })}</View><Text style={[styles.impactDescription, { color: palette.textMuted }]}>{impactMeta.desc}</Text></View>

          <SectionHeader eyebrow="Severity" title="Review the priority" subtitle="Snap to a level if the smart score feels off." palette={palette} onLayout={registerSection("severity")} />
          <SeverityControl value={severityValue} autoValue={derivedSeverityScore} manual={manualSeverity} onChange={(next) => { setManualSeverity(true); setSeverityValue(next); }} onReset={() => { setManualSeverity(false); setSeverityValue(derivedSeverityScore); }} palette={palette} />

          <SectionHeader eyebrow="AI Insight" title="What the system sees" palette={palette} />
          <Animated.View style={[styles.insightCard, { backgroundColor: palette.card, borderColor: palette.border, shadowColor: palette.shadow, opacity: insightAnim, transform: [{ translateY: insightAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}>
            <View style={styles.insightTopRow}><View style={styles.insightCopy}><Text style={[styles.insightTitle, { color: palette.text }]}>{insight.title}</Text><Text style={[styles.insightBody, { color: palette.textMuted }]}>{insight.body}</Text></View><View style={[styles.confidenceRow, { backgroundColor: insight.tone === "danger" ? palette.dangerSoft : insight.tone === "warning" ? palette.warningSoft : palette.successSoft }]}><Text style={[styles.confidenceRowLabel, { color: palette.textMuted }]}>Confidence</Text><Text style={[styles.confidenceRowValue, { color: palette.text }]}>{insight.confidence}%</Text></View></View>
            {joinCluster ? <View style={[styles.matchRow, { borderTopColor: palette.border }]}><Text style={[styles.matchText, { color: palette.textMuted }]}>Linked to cluster #{joinCluster.id} for faster triage</Text><Pressable onPress={() => setJoinClusterId(null)}><Text style={[styles.matchAction, { color: palette.primary }]}>Unlink</Text></Pressable></View> : topCluster ? <View style={[styles.matchRow, { borderTopColor: palette.border }]}><Text style={[styles.matchText, { color: palette.textMuted }]}>Nearby signal found {topCluster.distance_meters}m away</Text><Pressable onPress={() => setJoinClusterId(topCluster.id)}><Text style={[styles.matchAction, { color: palette.primary }]}>Link</Text></Pressable></View> : null}
          </Animated.View>
          <SectionHeader eyebrow="Cluster Map" title="Live context around you" subtitle="We surface active reports and pulses from nearby users." palette={palette} />
          <View style={[styles.mapCard, { backgroundColor: palette.card, borderColor: palette.border, shadowColor: palette.shadow }]}>{clusterMapLoading ? <View style={{ gap: 12 }}><SkeletonLoader height={180} borderRadius={24} /><SkeletonLoader height={14} width="45%" /></View> : <View style={styles.mapFrame}><LiveClusterMap clusters={clusterVisuals} focusRegion={clusterMapRegion} /><View style={[styles.mapOverlayCard, { backgroundColor: palette.mapOverlay, borderColor: palette.border }]}><Text style={[styles.mapOverlayTitle, { color: palette.text }]}>{clusterMessage}</Text><Text style={[styles.mapOverlaySub, { color: palette.textMuted }]}>{clusterVisuals.length > 0 ? "Dispatch can see an active pattern nearby." : "You may be the first person reporting this."}</Text></View></View>}</View>

          <SectionHeader eyebrow="Location" title="Current location" subtitle="Captured automatically, editable anytime." palette={palette} />
          <View style={[styles.glassCard, styles.locationRow, { backgroundColor: palette.card, borderColor: palette.border, shadowColor: palette.shadow }]}><View style={[styles.locationBadge, { backgroundColor: palette.primarySoft }]}><Text style={styles.locationBadgeIcon}>{"\uD83D\uDCCD"}</Text></View><View style={styles.locationTextWrap}><Text style={[styles.locationTitle, { color: palette.text }]}>Current Location</Text><Text style={[styles.locationValue, { color: palette.textMuted }]}>{locationLabel}</Text></View><Pressable onPress={() => refreshLocation()} style={[styles.changeButton, { backgroundColor: palette.elevated, borderColor: palette.border }]}>{refreshingLocation ? <ActivityIndicator size="small" color={palette.primary} /> : <Text style={[styles.changeButtonText, { color: palette.primary }]}>Change</Text>}</Pressable></View>

          <SectionHeader eyebrow="Notes" title="Add helpful details" subtitle="Optional, but useful if access or safety is tricky." palette={palette} />
          <View style={[styles.glassCard, { backgroundColor: palette.card, borderColor: palette.border, shadowColor: palette.shadow }]}><TextInput value={description} onChangeText={(text) => setDescription(text.slice(0, MAX_NOTE_LENGTH))} placeholder="Add details (optional)" placeholderTextColor={palette.textFaint} multiline style={[styles.notesInput, { backgroundColor: palette.input, color: palette.text, borderColor: palette.border }]} textAlignVertical="top" /><View style={styles.noteFooter}><Text style={[styles.noteHelper, { color: palette.textMuted }]}>Include landmarks, sounds, smells, or visible damage.</Text><Text style={[styles.noteCounter, { color: palette.textFaint }]}>{noteCount}/{MAX_NOTE_LENGTH}</Text></View></View>

          <SectionHeader eyebrow="Evidence" title="Add photos if you have them" subtitle="A clear photo can speed up verification." palette={palette} />
          <View style={styles.uploadActionsRow}><Pressable onPress={takePicture} style={[styles.uploadCard, { backgroundColor: palette.primary, borderColor: palette.primaryStrong, shadowColor: palette.primary }]}><Text style={styles.uploadIcon}>{"\uD83D\uDCF8"}</Text><Text style={[styles.uploadTitle, { color: palette.ctaText }]}>Camera</Text><Text style={[styles.uploadSubtitle, { color: "rgba(255,255,255,0.82)" }]}>Capture live evidence</Text></Pressable><Pressable onPress={pickImage} style={[styles.uploadCard, { backgroundColor: palette.card, borderColor: palette.border, shadowColor: palette.shadow }]}><Text style={styles.uploadIcon}>{"\uD83D\uDCC1"}</Text><Text style={[styles.uploadTitle, { color: palette.text }]}>Upload</Text><Text style={[styles.uploadSubtitle, { color: palette.textMuted }]}>Choose from device</Text></Pressable></View>
          {photoUris.length > 0 ? <View style={styles.previewGrid}>{photoUris.map((uri) => <View key={uri} style={[styles.previewTile, { borderColor: palette.border, backgroundColor: palette.card }]}><Image source={{ uri }} style={styles.previewImage} /><Pressable onPress={() => removePhoto(uri)} style={[styles.previewRemove, { backgroundColor: palette.mapOverlay }]}><Text style={[styles.previewRemoveText, { color: palette.text }]}>{"\u2715"}</Text></Pressable></View>)}</View> : null}
          <Text style={[styles.previewHint, { color: palette.textMuted }]}>Up to {MAX_PHOTOS} photos. {remainingPhotoSlots} slot{remainingPhotoSlots === 1 ? "" : "s"} left.</Text>
        </ScrollView>

        <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, 14), backgroundColor: palette.screen, borderTopColor: palette.border }]}><Pressable onPress={onSubmit} disabled={submitting} style={[styles.ctaButton, { shadowColor: palette.primary }]}><View style={styles.ctaGradientBase} /><View style={styles.ctaGradientAccent} /><View style={styles.ctaContent}><View><Text style={styles.ctaLabel}>{joinClusterId ? "Join existing signal" : "Submit new report"}</Text><Text style={styles.ctaSubtext}>{loadingSuggestions ? "Refreshing nearby activity" : technicians.length > 0 ? `Best available crew in ${technicians[0].zone}` : "Dispatch will prioritize based on impact and severity"}</Text></View>{submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaArrow}>{"\u2192"}</Text>}</View></Pressable></View>
      </View>

      <Modal visible={showCustomModal} transparent animationType="slide"><View style={styles.modalBackdrop}><View style={[styles.modalCard, { backgroundColor: palette.elevated, borderColor: palette.border }]}><View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: palette.text }]}>Describe the issue</Text><Pressable onPress={() => setShowCustomModal(false)}><Text style={[styles.modalClose, { color: palette.textMuted }]}>{"\u2715"}</Text></Pressable></View><TextInput value={customIssue} onChangeText={setCustomIssue} multiline numberOfLines={6} placeholder={`Tell us what ${utilityType} issue you're seeing...`} placeholderTextColor={palette.textFaint} style={[styles.customInput, { backgroundColor: palette.input, color: palette.text, borderColor: palette.border }]} textAlignVertical="top" /><Pressable disabled={!customIssue.trim()} onPress={onCustomIssueConfirm} style={[styles.modalAction, { backgroundColor: customIssue.trim() ? palette.primary : palette.border }]}><Text style={styles.modalActionText}>Use this description</Text></Pressable></View></View></Modal>
      <SuccessModal visible={showSuccessModal} title="Report synced" subtitle="Dispatch now sees your signal" onHide={() => setShowSuccessModal(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 }, screenWrap: { flex: 1 }, scrollContent: { paddingHorizontal: 20, paddingTop: 10 },
  heroCard: { borderWidth: 1, borderRadius: 28, padding: 20, overflow: "hidden", marginBottom: 18, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.12, shadowRadius: 30, elevation: 10 },
  heroGlow: { position: "absolute", width: 180, height: 180, borderRadius: 90, top: -40, left: -20 }, heroGlowSecondary: { position: "absolute", width: 220, height: 220, borderRadius: 110, right: -60, bottom: -90 },
  heroTopRow: { flexDirection: "row", alignItems: "center", gap: 14 }, heroIconWrap: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center" }, heroIcon: { fontSize: 28 }, heroTextWrap: { flex: 1 }, heroTitle: { fontSize: 28, fontWeight: "800", letterSpacing: -0.8 }, heroSubtitle: { marginTop: 4, fontSize: 14, lineHeight: 20, fontWeight: "500" }, quickChipRow: { paddingTop: 18, paddingBottom: 4, gap: 10 }, quickChip: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 }, quickChipText: { fontSize: 13, fontWeight: "700" }, heroMetaRow: { flexDirection: "row", gap: 10, marginTop: 16, flexWrap: "wrap" }, metaPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, metaPillText: { fontSize: 12, fontWeight: "700" },
  sectionHeader: { marginTop: 10, marginBottom: 12 }, sectionEyebrow: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 6 }, sectionTitle: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 }, sectionSubtitle: { marginTop: 6, fontSize: 13, lineHeight: 19, fontWeight: "500" },
  glassCard: { borderWidth: 1, borderRadius: 24, padding: 16, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 6 },
  utilitySelectorRow: { flexDirection: "row", gap: 12 }, utilityPill: { flex: 1, borderWidth: 1, borderRadius: 22, padding: 16, minHeight: 126, justifyContent: "space-between", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 4 }, utilityPillIcon: { fontSize: 26 }, utilityPillTitle: { marginTop: 18, fontSize: 17, fontWeight: "800" }, utilityPillDesc: { marginTop: 6, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  issueGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, issueCard: { width: "48.3%", borderWidth: 1, borderRadius: 24, padding: 16, minHeight: 154, justifyContent: "space-between", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 5 }, issueCardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", minHeight: 30 }, issueIconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }, issueIcon: { fontSize: 20 }, badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, maxWidth: 120 }, badgeText: { fontSize: 10, fontWeight: "800", lineHeight: 12 }, issueTitle: { marginTop: 18, fontSize: 16, fontWeight: "800", letterSpacing: -0.3 }, issueDesc: { marginTop: 8, fontSize: 12, lineHeight: 18, fontWeight: "500" }, seeMoreWrap: { paddingVertical: 14 }, seeMoreText: { fontSize: 14, fontWeight: "700" },
  impactRow: { flexDirection: "row", gap: 10 }, impactPill: { flex: 1, borderWidth: 1, borderRadius: 20, paddingVertical: 14, alignItems: "center", justifyContent: "center", minHeight: 84 }, impactIcon: { fontSize: 22, marginBottom: 8 }, impactLabel: { fontSize: 12, fontWeight: "800", textAlign: "center" }, impactDescription: { marginTop: 14, fontSize: 13, lineHeight: 18, fontWeight: "500" },
  severityTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }, severityEmoji: { fontSize: 20, fontWeight: "800" }, severityFeedback: { marginTop: 6, fontSize: 13, fontWeight: "500", lineHeight: 18 }, inlineChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, inlineChipText: { fontSize: 12, fontWeight: "800" }, severitySegmentRow: { marginTop: 18, flexDirection: "row", gap: 8 }, severitySegment: { flex: 1, minHeight: 86, borderWidth: 1, borderRadius: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, paddingVertical: 10 }, severitySegmentEmoji: { fontSize: 20, marginBottom: 8 }, severitySegmentLabel: { fontSize: 11, fontWeight: "800", textAlign: "center" },
  insightCard: { borderWidth: 1, borderRadius: 24, padding: 18, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 6 }, insightTopRow: { gap: 14 }, insightCopy: { minWidth: 0 }, insightTitle: { fontSize: 18, fontWeight: "800", lineHeight: 24 }, insightBody: { marginTop: 8, fontSize: 13, lineHeight: 19, fontWeight: "500" }, confidenceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 }, confidenceRowLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7 }, confidenceRowValue: { fontSize: 20, fontWeight: "900" }, matchRow: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 }, matchText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 18 }, matchAction: { fontSize: 12, fontWeight: "800" },
  mapCard: { borderWidth: 1, borderRadius: 28, padding: 14, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 6 }, mapFrame: { overflow: "hidden", borderRadius: 22, height: 210 }, mapOverlayCard: { position: "absolute", left: 12, right: 12, bottom: 12, borderRadius: 18, padding: 14, borderWidth: 1 }, mapOverlayTitle: { fontSize: 14, fontWeight: "800" }, mapOverlaySub: { marginTop: 4, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 12 }, locationBadge: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" }, locationBadgeIcon: { fontSize: 22 }, locationTextWrap: { flex: 1 }, locationTitle: { fontSize: 15, fontWeight: "800" }, locationValue: { marginTop: 4, fontSize: 12, lineHeight: 18, fontWeight: "500" }, changeButton: { minWidth: 74, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center" }, changeButtonText: { fontSize: 12, fontWeight: "800" },
  notesInput: { minHeight: 124, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontWeight: "500" }, noteFooter: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }, noteHelper: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "500" }, noteCounter: { fontSize: 12, fontWeight: "700" },
  uploadActionsRow: { flexDirection: "row", gap: 12 }, uploadCard: { flex: 1, borderWidth: 1, borderRadius: 24, padding: 18, minHeight: 132, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 5 }, uploadIcon: { fontSize: 24 }, uploadTitle: { marginTop: 18, fontSize: 18, fontWeight: "800" }, uploadSubtitle: { marginTop: 6, fontSize: 12, lineHeight: 17, fontWeight: "500" }, previewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 14 }, previewTile: { width: "30.8%", aspectRatio: 1, borderRadius: 18, borderWidth: 1, overflow: "hidden" }, previewImage: { width: "100%", height: "100%" }, previewRemove: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" }, previewRemoveText: { fontSize: 14, fontWeight: "800" }, previewHint: { marginTop: 12, marginBottom: 12, fontSize: 12, fontWeight: "600" },
  ctaBar: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1 }, ctaButton: { borderRadius: 24, overflow: "hidden", minHeight: 76, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.28, shadowRadius: 24, elevation: 8 }, ctaGradientBase: { ...StyleSheet.absoluteFillObject, backgroundColor: "#4f46e5" }, ctaGradientAccent: { position: "absolute", right: -40, top: -10, width: 180, height: 120, borderRadius: 60, backgroundColor: "rgba(37,99,235,0.55)" }, ctaContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 18 }, ctaLabel: { color: "rgba(255,255,255,0.76)", fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.9 }, ctaSubtext: { color: "rgba(255,255,255,0.88)", fontSize: 12, marginTop: 6, fontWeight: "500", maxWidth: 240, lineHeight: 17 }, ctaArrow: { color: "#fff", fontSize: 28, fontWeight: "500" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end", padding: 18 }, modalCard: { borderWidth: 1, borderRadius: 28, padding: 18 }, modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }, modalTitle: { fontSize: 20, fontWeight: "800" }, modalClose: { fontSize: 20, fontWeight: "700" }, customInput: { minHeight: 150, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, fontWeight: "500" }, modalAction: { marginTop: 16, borderRadius: 18, paddingVertical: 16, alignItems: "center" }, modalActionText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});








