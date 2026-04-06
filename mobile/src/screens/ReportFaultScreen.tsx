import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View, Modal, TextInput, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import Screen from "../components/Screen";
import FormInput from "../components/FormInput";
import SeveritySlider from "../components/SeveritySlider";
import AutoSuggestionChips from "../components/AutoSuggestionChips";
import LiveClusterMap, { LiveClusterPoint } from "../components/LiveClusterMap";
import SuccessModal from "../components/SuccessModal";
import SkeletonLoader from "../components/SkeletonLoader";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

type SuggestedCluster = {
  id: number;
  title: string;
  status: string;
  report_count: number;
  priority_score: number;
  distance_meters: number;
  estimated_resolution_minutes?: number;
  priority_reasons?: string[];
  radius_meters?: number;
};

type TechnicianOption = {
  id: number;
  name: string;
  phone: string;
  rating: number;
  specialization: string;
  zone: string;
};

type ClusterVisual = LiveClusterPoint & {
  priority_reasons?: string[];
  report_count?: number;
};

type UtilityType = "electricity" | "water";
type ImpactLevel = "just_me" | "few_homes" | "whole_street" | "dangerous_emergency";

const ISSUE_OPTIONS: Record<UtilityType, { id: string; label: string; desc: string }[]> = {
  electricity: [
    { id: "no_power", label: "No power at all", desc: "Complete outage" },
    { id: "flickering", label: "Power keeps flickering", desc: "Frequent interruption" },
    { id: "spark_smell", label: "Spark or burning smell", desc: "Safety risk" },
    { id: "dangerous_wire", label: "Loose wire or dangerous pole", desc: "Emergency hazard" },
    { id: "streetlight", label: "Streetlight issue", desc: "Public lighting only" },
  ],
  water: [
    { id: "no_supply", label: "No water supply", desc: "No water coming" },
    { id: "low_pressure", label: "Low water pressure", desc: "Weak flow" },
    { id: "leakage", label: "Water leakage", desc: "Leak from line" },
    { id: "dirty_water", label: "Dirty or contaminated water", desc: "Unsafe quality" },
    { id: "burst_pipe", label: "Burst pipe or flooding", desc: "Emergency water loss" },
  ],
};

const IMPACT_OPTIONS: { id: ImpactLevel; label: string; desc: string }[] = [
  { id: "just_me", label: "Just my home", desc: "Single house or apartment" },
  { id: "few_homes", label: "A few homes", desc: "Small local issue" },
  { id: "whole_street", label: "Whole street or area", desc: "Wider neighborhood impact" },
  { id: "dangerous_emergency", label: "Dangerous emergency", desc: "Immediate safety concern" },
];

const IMPACT_BADGES: Record<ImpactLevel, string> = {
  just_me: "Low spread",
  few_homes: "Local cluster",
  whole_street: "Area-wide",
  dangerous_emergency: "Emergency",
};

const MAX_PHOTOS = 4;
const IMAGE_MEDIA_TYPE: ImagePicker.MediaType = "images";

function derivedSeverity(utilityType: UtilityType, issueType: string, impactLevel: ImpactLevel) {
  const baseMap: Record<UtilityType, Record<string, number>> = {
    electricity: {
      no_power: 4,
      flickering: 3,
      spark_smell: 5,
      dangerous_wire: 5,
      streetlight: 2,
    },
    water: {
      no_supply: 4,
      low_pressure: 2,
      leakage: 3,
      dirty_water: 4,
      burst_pipe: 5,
    },
  };
  const impactBonus: Record<ImpactLevel, number> = {
    just_me: 0,
    few_homes: 0,
    whole_street: 1,
    dangerous_emergency: 1,
  };
  return Math.min((baseMap[utilityType][issueType] ?? 3) + impactBonus[impactLevel], 5);
}

export default function ReportFaultScreen() {
  const { token } = useAuth();
  const [utilityType, setUtilityType] = useState<UtilityType>("electricity");
  const [issueType, setIssueType] = useState<string>(ISSUE_OPTIONS.electricity[0].id);
  const [impactLevel, setImpactLevel] = useState<ImpactLevel>("few_homes");
  const [description, setDescription] = useState("");
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestedClusters, setSuggestedClusters] = useState<SuggestedCluster[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [joinClusterId, setJoinClusterId] = useState<number | null>(null);
  const [preferredTechnicianId, setPreferredTechnicianId] = useState<number | null>(null);
  const [customIssue, setCustomIssue] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [manualSeverity, setManualSeverity] = useState(false);
  const [severityValue, setSeverityValue] = useState(() => derivedSeverity(utilityType, issueType, impactLevel));
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [clusterVisuals, setClusterVisuals] = useState<ClusterVisual[]>([]);
  const [clusterMapLoading, setClusterMapLoading] = useState(true);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingPhotoSlots = Math.max(0, MAX_PHOTOS - photoUris.length);

  const appendPhotoAssets = (assets: ImagePicker.ImagePickerAsset[] | undefined) => {
    if (!assets?.length) {
      return;
    }
    setPhotoUris((prev) => {
      const available = MAX_PHOTOS - prev.length;
      if (available <= 0) {
        return prev;
      }
      const next = assets
        .filter((asset) => asset?.uri)
        .slice(0, available)
        .map((asset) => asset.uri);
      if (!next.length) {
        return prev;
      }
      return [...prev, ...next];
    });
  };

  const removePhoto = (uri: string) => {
    setPhotoUris((prev) => prev.filter((item) => item !== uri));
  };

  useEffect(() => {
    setIssueType(ISSUE_OPTIONS[utilityType][0].id);
    setJoinClusterId(null);
  }, [utilityType]);

  const derivedSeverityScore = useMemo(() => derivedSeverity(utilityType, issueType, impactLevel), [utilityType, issueType, impactLevel]);
  useEffect(() => {
    if (!manualSeverity) {
      setSeverityValue(derivedSeverityScore);
    }
  }, [derivedSeverityScore, manualSeverity]);
  const issueLabel = ISSUE_OPTIONS[utilityType].find((item) => item.id === issueType)?.label ?? "Issue";
  const generatedTitle = `${issueLabel} / ${IMPACT_OPTIONS.find((item) => item.id === impactLevel)?.label ?? "Impact"}`;
  const severityNarrative = useMemo(() => {
    if (severityValue >= 5) return "Critical outage signal";
    if (severityValue >= 4) return "High impact – dispatch quickly";
    if (severityValue >= 3) return "Moderate issue – monitored";
    return "Low severity – still logged";
  }, [severityValue]);
  const handleSeverityChange = (next: number) => {
    setManualSeverity(true);
    setSeverityValue(next);
  };
  const resetSeverity = () => {
    setManualSeverity(false);
    setSeverityValue(derivedSeverityScore);
  };
  const topCluster = suggestedClusters[0] ?? null;
  const suggestionPills = useMemo(() => {
    const chips: { label: string; meta?: string }[] = [];
    if (topCluster) {
      chips.push({
        label: `${topCluster.report_count} nearby reports`,
        meta: `${Math.round(topCluster.priority_score)}% priority`
      });
      if (topCluster.estimated_resolution_minutes) {
        chips.push({ label: `ETA ${topCluster.estimated_resolution_minutes}m`, meta: "City estimate" });
      }
    }
    chips.push({ label: issueLabel, meta: "Issue tag" });
    chips.push({ label: IMPACT_BADGES[impactLevel], meta: "Impact" });
    return chips.slice(0, 4);
  }, [topCluster, issueLabel, impactLevel]);
  const autoMessage = useMemo(() => {
    if (!topCluster) return null;
    const reason = topCluster.priority_reasons?.[0];
    return `${topCluster.report_count} neighbours already flagged this${reason ? ` • ${reason}` : ""}`;
  }, [topCluster]);
  const handleSuggestionChip = (text: string) => {
    setDescription((prev) => (prev ? `${prev.trim()} • ${text}` : text));
  };
  const clusterMapRegion = useMemo(() => {
    if (!location) {
      return undefined;
    }
    return {
      latitude: location.latitude,
      longitude: location.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [location]);

  const pickImage = async () => {
    if (remainingPhotoSlots <= 0) {
      Alert.alert("Limit reached", `You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow photo library access.");
      return;
    }
    const limit = Math.max(1, remainingPhotoSlots || 1);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: IMAGE_MEDIA_TYPE,
      allowsMultipleSelection: true,
      selectionLimit: limit,
      quality: 0.7,
    });
    if (!result.canceled) {
      appendPhotoAssets(result.assets);
    }
  };

  const takePicture = async () => {
    if (remainingPhotoSlots <= 0) {
      Alert.alert("Limit reached", `You can attach up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow camera access.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: IMAGE_MEDIA_TYPE,
      allowsEditing: false,
      quality: 0.75,
    });

    if (!result.canceled) {
      appendPhotoAssets(result.assets);
    }
  };

  const handleCustomIssue = () => {
    if (customIssue.trim()) {
      setIssueType(`custom_${Date.now()}`);
      setShowCustomModal(false);
    }
  };

  const loadClusterVisuals = async (coords: { latitude: number; longitude: number }) => {
    try {
      setClusterMapLoading(true);
      const response = await apiRequest<{ items: ClusterVisual[] }>(
        `/reports/nearby?latitude=${coords.latitude}&longitude=${coords.longitude}`,
        { token }
      );
      const enriched = (response.items ?? []).map((item) => ({
        ...item,
        radius_meters: item.radius_meters ?? Math.max(180, (item.report_count ?? 1) * 90),
      }));
      setClusterVisuals(enriched);
    } catch (error) {
      console.warn("Cluster map load failed", error);
    } finally {
      setClusterMapLoading(false);
    }
  };

  const fetchSuggestions = async (coords?: { latitude: number; longitude: number }) => {
    try {
      setLoadingSuggestions(true);
      let currentCoords = coords ?? location;
      if (!currentCoords) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          setLoadingSuggestions(false);
          return;
        }
        const current = await Location.getCurrentPositionAsync({});
        currentCoords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        setLocation(currentCoords);
      }

      const response = await apiRequest<{ clusters: SuggestedCluster[]; technicians: TechnicianOption[] }>(
        `/reports/suggestions?utility_type=${utilityType}&latitude=${currentCoords.latitude}&longitude=${currentCoords.longitude}`,
        { token }
      );
      setSuggestedClusters(response.clusters ?? []);
      setTechnicians(response.technicians ?? []);
      if ((response.clusters ?? []).length === 0) {
        setJoinClusterId(null);
      }
      if ((response.technicians ?? []).length > 0 && !preferredTechnicianId) {
        setPreferredTechnicianId(response.technicians[0].id);
      }
      if (currentCoords) {
        await loadClusterVisuals(currentCoords);
      }
    } catch (error) {
      Alert.alert("Suggestion check failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [utilityType]);

  useEffect(() => () => {
    if (successTimer.current) {
      clearTimeout(successTimer.current);
    }
  }, []);

  const onSubmit = async () => {
    if (submitting) return;
    try {
      setSubmitting(true);
      const locationPermission = await Location.requestForegroundPermissionsAsync();
      if (locationPermission.status !== "granted") {
        Alert.alert("Location required", "Please allow location access for accurate reporting.");
        setSubmitting(false);
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      const coords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      setLocation(coords);

      const uploadedPhotoUrls: string[] = [];
      for (let index = 0; index < photoUris.length; index += 1) {
        const uri = photoUris[index];
        if (!uri) {
          continue;
        }
        const form = new FormData();
        form.append("file", { uri, name: `fault-photo-${index + 1}.jpg`, type: "image/jpeg" } as any);
        const uploadResponse = await apiRequest<{ photo_url: string }>("/upload", {
          method: "POST",
          body: form,
          isFormData: true,
        });
        if (uploadResponse.photo_url) {
          uploadedPhotoUrls.push(uploadResponse.photo_url);
        }
      }

      await apiRequest("/reports", {
        method: "POST",
        token,
        body: {
          utility_type: utilityType,
          issue_type: issueType,
          impact_level: impactLevel,
          title: generatedTitle,
          description,
          latitude: coords.latitude,
          longitude: coords.longitude,
          photo_urls: uploadedPhotoUrls,
          join_cluster_id: joinClusterId,
          preferred_technician_id: preferredTechnicianId,
          severity: severityValue,
        },
      });

      setDescription("");
      setPhotoUris([]);
      setJoinClusterId(null);
      setImpactLevel("few_homes");
      setManualSeverity(false);
      setShowSuccessModal(true);
      if (successTimer.current) {
        clearTimeout(successTimer.current);
      }
      successTimer.current = setTimeout(() => setShowSuccessModal(false), 2200);
      Alert.alert("Success", joinClusterId ? "Your report was added to an existing outage signal." : "Your report has been submitted.");
      fetchSuggestions(coords);
      loadClusterVisuals(coords);
    } catch (error) {
      Alert.alert("Submission failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const severityColor = severityValue >= 4 ? T.electric : severityValue === 3 ? T.amber : T.emerald;
  const activeJoinCluster = suggestedClusters.find((item) => item.id === joinClusterId) ?? null;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>⚡ Report a Fault</Text>
        <Text style={styles.subtitle}>Help us fix things faster. Tell us exactly what you see.</Text>
      </View>

      {suggestionPills.length > 0 && (
        <AutoSuggestionChips suggestions={suggestionPills} onSelect={handleSuggestionChip} style={{ marginBottom: 16 }} />
      )}

      {autoMessage ? (
        <View style={styles.intelBanner}>
          <Text style={styles.intelBannerTitle}>{autoMessage}</Text>
          {topCluster?.estimated_resolution_minutes ? (
            <Text style={styles.intelBannerMeta}>Estimated fix {topCluster.estimated_resolution_minutes} min</Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.formLabel}>⚙️ Choose utility</Text>
      <View style={styles.typeSelector}>
        {[
          { id: "electricity", icon: "⚡", name: "Electricity", desc: "Power outages, wiring" },
          { id: "water", icon: "💧", name: "Water", desc: "Leaks, no supply" },
        ].map((opt) => (
          <Pressable key={opt.id} onPress={() => setUtilityType(opt.id as UtilityType)} style={[styles.typeOption, utilityType === opt.id && (opt.id === "electricity" ? styles.typeOptionElectricity : styles.typeOptionWater)]}>
            <Text style={styles.typeEmoji}>{opt.icon}</Text>
            <Text style={styles.typeName}>{opt.name}</Text>
            <Text style={styles.typeDesc}>{opt.desc}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.formLabel}>🔍 What are you seeing?</Text>
      <View style={styles.optionGrid}>
        {ISSUE_OPTIONS[utilityType].map((option) => {
          const selected = issueType === option.id;
          return (
            <Pressable key={option.id} onPress={() => setIssueType(option.id)} style={[styles.optionCard, selected && styles.optionCardSelected]}>
              <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{option.label}</Text>
              <Text style={[styles.optionDesc, selected && styles.optionDescSelected]}>{option.desc}</Text>
            </Pressable>
          );
        })}
        <Pressable 
          onPress={() => setShowCustomModal(true)} 
          style={[styles.optionCard, issueType.startsWith("custom_") && styles.optionCardSelected]}
        >
          <Text style={[styles.optionTitle, issueType.startsWith("custom_") && styles.optionTitleSelected]}>Custom issue</Text>
          <Text style={[styles.optionDesc, issueType.startsWith("custom_") && styles.optionDescSelected]}>
            {customIssue || "Write your own description"}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.formLabel}>📊 How wide is the impact?</Text>
      <View style={styles.optionGrid}>
        {IMPACT_OPTIONS.map((option) => {
          const selected = impactLevel === option.id;
          return (
            <Pressable key={option.id} onPress={() => setImpactLevel(option.id)} style={[styles.optionCard, selected && styles.optionCardSelected]}>
              <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>{option.label}</Text>
              <Text style={[styles.optionDesc, selected && styles.optionDescSelected]}>{option.desc}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.formLabel}>🎚️ Adjust severity</Text>
      <View style={styles.sliderCard}>
        <SeveritySlider value={severityValue} onChange={handleSeverityChange} min={1} max={5} />
        <View style={styles.sliderMeta}>
          <Text style={styles.sliderMetaText}>{severityNarrative}</Text>
          {manualSeverity ? (
            <Pressable onPress={resetSeverity}>
              <Text style={styles.sliderReset}>Reset to auto (S{derivedSeverityScore})</Text>
            </Pressable>
          ) : (
            <Text style={styles.sliderHint}>Auto estimated at S{derivedSeverityScore}</Text>
          )}
        </View>
      </View>

      <Text style={styles.formLabel}>⚠️ Auto-estimated urgency</Text>
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.summaryTitle}>{generatedTitle}</Text>
            <Text style={styles.summaryMeta}>Impact tag: {IMPACT_BADGES[impactLevel]}</Text>
          </View>
          <View style={[styles.severityBadge, { backgroundColor: severityColor }]}>
            <Text style={styles.severityBadgeText}>S{severityValue}</Text>
          </View>
        </View>
        <Text style={styles.summaryBody}>Users choose the issue and impact in plain language. The app converts that into an internal severity score for routing and prioritization.</Text>
      </View>

      <Text style={styles.formLabel}>🗺️ Live outage clusters</Text>
      <View style={styles.clusterMapCard}>
        {clusterMapLoading ? (
          <View style={{ gap: 10 }}>
            <SkeletonLoader height={140} borderRadius={18} />
            <SkeletonLoader height={14} width="60%" />
          </View>
        ) : (
          <LiveClusterMap clusters={clusterVisuals} focusRegion={clusterMapRegion} />
        )}
      </View>
      <Text style={styles.mapCaption}>
        {clusterVisuals.length > 0 ? `${clusterVisuals.length} active cluster${clusterVisuals.length === 1 ? "" : "s"} near you` : "No live clusters detected around your coordinates"}
      </Text>

      <Text style={styles.formLabel}>🔎 Nearby outage check</Text>
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Text style={styles.infoTitle}>Possible duplicate reports nearby</Text>
          <Pressable onPress={() => fetchSuggestions()}>
            <Text style={styles.infoAction}>{loadingSuggestions ? "Checking..." : "Refresh"}</Text>
          </Pressable>
        </View>
        {suggestedClusters.length === 0 ? (
          <Text style={styles.infoMuted}>No active nearby cluster found for this utility type right now.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {suggestedClusters.map((cluster) => {
              const selected = joinClusterId === cluster.id;
              return (
                <Pressable key={cluster.id} onPress={() => setJoinClusterId(selected ? null : cluster.id)} style={[styles.suggestionCard, selected && styles.suggestionCardSelected]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionTitle}>{cluster.title}</Text>
                    <Text style={styles.suggestionMeta}>{cluster.report_count} reports / {Math.round(cluster.priority_score)}% priority / {cluster.distance_meters} m away</Text>
                  </View>
                  <Text style={styles.suggestionToggle}>{selected ? "Joined" : "Join"}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <Text style={styles.formLabel}>👨‍🔧 Preferred technician</Text>
      <View style={styles.infoCard}>
        <Text style={styles.infoMuted}>Choose a preferred technician by rating. Dispatch still confirms the final assignment.</Text>
        <View style={styles.technicianWrap}>
          {technicians.map((technician) => {
            const selected = preferredTechnicianId === technician.id;
            return (
              <Pressable key={technician.id} onPress={() => setPreferredTechnicianId(technician.id)} style={[styles.techChip, selected && styles.techChipSelected]}>
                <Text style={[styles.techChipTitle, selected && styles.techChipTitleSelected]}>{technician.name}</Text>
                <Text style={[styles.techChipMeta, selected && styles.techChipMetaSelected]}>{technician.rating.toFixed(1)} / {technician.zone}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={styles.formLabel}>📍 Location</Text>
      <View style={styles.locationCard}>
        <View style={styles.locationIcon}><Text>LOC</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.locationTitle}>Current location</Text>
          <Text style={styles.locationAddress}>{activeJoinCluster ? `Will be linked near cluster #${activeJoinCluster.id}.` : "Live coordinates will be captured when you submit."}</Text>
        </View>
        <Text style={styles.locationChange}>Auto</Text>
      </View>

      <Text style={styles.formLabel}>📝 Additional notes</Text>
      <View style={styles.formCard}>
        <FormInput label="Description" value={description} onChangeText={setDescription} placeholder="Anything else the crew should know?" multiline />
      </View>

      <Text style={styles.formLabel}>📸 Evidence</Text>
      <View style={styles.photoSection}>
        {photoUris.length > 0 && (
          <>
            <View style={styles.photoPreviewGrid}>
              {photoUris.map((uri) => (
                <View key={uri} style={styles.photoPreviewContainer}>
                  <Image source={{ uri }} style={styles.photoPreview} />
                  <Pressable style={styles.removePhotoButton} onPress={() => removePhoto(uri)}>
                    <Text style={styles.removePhotoText}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
            {remainingPhotoSlots > 0 ? (
              <Text style={styles.photoHint}>{`${remainingPhotoSlots} slot${remainingPhotoSlots === 1 ? "" : "s"} left`}</Text>
            ) : (
              <Text style={styles.photoLimitText}>You attached the maximum of {MAX_PHOTOS} photos.</Text>
            )}
          </>
        )}

        {remainingPhotoSlots > 0 && (
          <View style={styles.photoButtonsContainer}>
            <Pressable style={styles.photoButton} onPress={takePicture}>
              <Text style={styles.photoButtonIcon}>📷</Text>
              <Text style={styles.photoButtonText}>Take photo</Text>
              <Text style={styles.photoButtonSub}>Direct capture</Text>
            </Pressable>
            <Pressable style={styles.photoButton} onPress={pickImage}>
              <Text style={styles.photoButtonIcon}>📁</Text>
              <Text style={styles.photoButtonText}>Upload photo</Text>
              <Text style={styles.photoButtonSub}>From device</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Pressable style={[styles.submitButton, submitting && styles.submitButtonDisabled]} onPress={onSubmit} disabled={submitting}>
        <View style={styles.submitContent}>
          <Text style={styles.submitLabel}>{joinClusterId ? "Existing signal" : "New report"}</Text>
          <Text style={styles.submitText}>{joinClusterId ? "Join existing outage" : "Submit report"}</Text>
          <Text style={styles.submitSub}>{preferredTechnicianId ? "Technician preference will be shared with dispatch." : "Dispatch will assign the best available technician."}</Text>
        </View>
        <View style={[styles.submitCTAIcon, submitting && styles.submitCTAIconBusy]}>
          {submitting ? <ActivityIndicator color={T.primary} /> : <Text style={styles.submitCTAIconText}>→</Text>}
        </View>
      </Pressable>

      {/* Custom Issue Modal */}
      <Modal visible={showCustomModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Describe the issue</Text>
              <Pressable onPress={() => setShowCustomModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </Pressable>
            </View>
            
            <TextInput
              style={styles.customInput}
              placeholder={`Tell us what ${utilityType} issue you're experiencing...`}
              placeholderTextColor="#999"
              value={customIssue}
              onChangeText={setCustomIssue}
              multiline
              numberOfLines={6}
            />
            
            <Pressable 
              style={[styles.modalButton, !customIssue.trim() && styles.modalButtonDisabled]}
              onPress={handleCustomIssue}
              disabled={!customIssue.trim()}
            >
              <Text style={styles.modalButtonText}>Use this description</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <SuccessModal
        visible={showSuccessModal}
        title="Report synced"
        subtitle="Dispatch now sees your signal"
        onHide={() => setShowSuccessModal(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 20, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  title: { fontSize: 32, fontWeight: "900", color: T.text, letterSpacing: -0.8, marginBottom: 8 },
  subtitle: { fontSize: 14, color: T.textSecondary, fontWeight: "500", lineHeight: 20 },
  formLabel: { fontSize: 13, fontWeight: "800", color: T.text, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 14, marginTop: 24, opacity: 0.9 },
  
  // Type Selector
  typeSelector: { flexDirection: "row", gap: 12, marginBottom: 8 },
  typeOption: { 
    flex: 1, 
    borderRadius: 18, 
    padding: 20, 
    borderWidth: 2.5, 
    borderColor: T.border, 
    backgroundColor: T.surface,
    alignItems: "center",
    transform: [{ scale: 1 }],
  },
  typeOptionElectricity: { 
    borderColor: T.electric, 
    backgroundColor: T.electricSoft,
    shadowColor: T.electric,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  typeOptionWater: { 
    borderColor: T.water, 
    backgroundColor: T.waterSoft,
    shadowColor: T.water,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  typeEmoji: { fontSize: 44, marginBottom: 10 },
  typeName: { fontSize: 15, fontWeight: "800", color: T.text, marginBottom: 2, letterSpacing: -0.3 },
  typeDesc: { fontSize: 12, color: T.textSecondary, fontWeight: "600" },
  
  // Options Grid
  optionGrid: { gap: 12, marginBottom: 8 },
  optionCard: { 
    borderRadius: 16, 
    padding: 16, 
    backgroundColor: T.surface, 
    borderWidth: 2, 
    borderColor: "#e5e7eb",
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  optionCardSelected: { 
    borderColor: T.electric, 
    backgroundColor: T.electricSoft,
    borderWidth: 2.5,
    shadowColor: T.electric,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  optionTitle: { fontSize: 14, fontWeight: "700", color: T.text, letterSpacing: -0.2 },
  optionTitleSelected: { color: T.electric, fontWeight: "800" },
  optionDesc: { fontSize: 12, color: T.textSecondary, marginTop: 5, lineHeight: 16 },
  optionDescSelected: { color: "#555", fontWeight: "600" },
  
  // Summary Card
  summaryCard: { 
    backgroundColor: T.surface, 
    borderRadius: 16, 
    padding: 18, 
    borderWidth: 2, 
    borderColor: "#e5e7eb",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  summaryTitle: { fontSize: 16, fontWeight: "800", color: T.text, letterSpacing: -0.3 },
  summaryMeta: { fontSize: 12, color: T.textSecondary, marginTop: 6, fontWeight: "600" },
  summaryBody: { fontSize: 13, color: T.textSecondary, lineHeight: 20, fontWeight: "500" },
  severityBadge: { width: 56, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  severityBadgeText: { color: T.white, fontWeight: "900", fontSize: 16 },
  sliderCard: {
    backgroundColor: T.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: 20,
  },
  sliderMeta: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderMetaText: {
    fontSize: 13,
    fontWeight: "700",
    color: T.text,
    flex: 1,
    marginRight: 12,
  },
  sliderReset: {
    fontSize: 12,
    fontWeight: "700",
    color: T.water,
  },
  sliderHint: {
    fontSize: 12,
    fontWeight: "600",
    color: T.textSecondary,
  },
  
  // Info Card
  infoCard: { 
    backgroundColor: T.surface, 
    borderRadius: 14, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: T.border, 
    gap: 12,
    marginBottom: 20,
  },
  infoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoTitle: { fontSize: 14, fontWeight: "700", color: T.text },
  infoAction: { fontSize: 12, fontWeight: "700", color: T.primary },
  infoMuted: { fontSize: 12, color: T.textSecondary, fontWeight: "500", lineHeight: 18 },
  
  // Suggestions
  suggestionCard: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 12, 
    padding: 12, 
    borderRadius: 12, 
    backgroundColor: T.background,
    borderWidth: 1, 
    borderColor: T.border,
  },
  suggestionCardSelected: { 
    borderColor: T.primary, 
    backgroundColor: T.primaryLight, 
  },
  suggestionTitle: { fontSize: 13, fontWeight: "700", color: T.text },
  suggestionMeta: { fontSize: 11, color: T.textSecondary, marginTop: 2 },
  suggestionToggle: { fontSize: 11, fontWeight: "700", color: T.primary },
  intelBanner: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: T.electricSoft,
    borderWidth: 1,
    borderColor: T.electric,
    marginBottom: 18,
  },
  intelBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: T.electric,
    marginBottom: 4,
  },
  intelBannerMeta: {
    fontSize: 11,
    color: T.textSecondary,
    fontWeight: "600",
  },
  clusterMapCard: {
    height: 180,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    marginBottom: 6,
  },
  mapCaption: {
    fontSize: 12,
    color: T.textSecondary,
    marginBottom: 12,
  },
  
  // Technician
  technicianWrap: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  techChip: { 
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderRadius: 10, 
    backgroundColor: T.surface, 
    borderWidth: 1, 
    borderColor: T.border,
  },
  techChipSelected: { 
    borderColor: T.water, 
    backgroundColor: T.waterLight, 
  },
  techChipTitle: { fontSize: 12, fontWeight: "700", color: T.text },
  techChipTitleSelected: { color: T.water },
  techChipMeta: { fontSize: 10, color: T.textSecondary, marginTop: 2 },
  techChipMetaSelected: { color: T.water },
  
  // Location
  locationCard: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 12, 
    padding: 14, 
    borderRadius: 14, 
    backgroundColor: T.surface, 
    borderWidth: 1, 
    borderColor: T.border,
    marginBottom: 20,
  },
  locationIcon: { 
    width: 40, 
    height: 40, 
    borderRadius: 10, 
    backgroundColor: T.waterLight, 
    alignItems: "center", 
    justifyContent: "center",
    fontSize: 20,
  },
  locationTitle: { fontSize: 13, fontWeight: "600", color: T.text },
  locationAddress: { fontSize: 11, color: T.textSecondary, fontWeight: "500" },
  locationChange: { fontSize: 11, fontWeight: "700", color: T.water },
  
  // Form Card
  formCard: { 
    backgroundColor: T.surface, 
    borderRadius: 14, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: T.border,
    marginBottom: 20,
  },
  
  // Photo Evidence
  photoSection: { marginBottom: 20 },
  photoPreviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  photoButtonsContainer: { flexDirection: "row", gap: 14, marginTop: 12 },
  photoButton: { 
    flex: 1, 
    borderRadius: 16, 
    padding: 18, 
    backgroundColor: T.surface, 
    borderWidth: 2, 
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  photoButtonIcon: { fontSize: 40, marginBottom: 10 },
  photoButtonText: { fontSize: 14, fontWeight: "800", color: T.text, textAlign: "center", letterSpacing: -0.2 },
  photoButtonSub: { fontSize: 11, color: T.textSecondary, marginTop: 6, fontWeight: "600" },
  photoHint: { fontSize: 12, color: T.textSecondary, fontWeight: "600", marginTop: 8 },
  photoLimitText: { fontSize: 12, color: T.textSecondary, fontWeight: "600", marginTop: 8 },
  
  // Photo Preview
  photoPreviewContainer: { 
    position: "relative", 
    borderRadius: 14, 
    overflow: "hidden", 
    width: "48%",
    marginBottom: 12,
  },
  photoPreview: { 
    width: "100%", 
    height: 160, 
    borderRadius: 14,
  },
  removePhotoButton: { 
    position: "absolute", 
    top: 8, 
    right: 8, 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  removePhotoText: { fontSize: 20, color: T.white, fontWeight: "700" },
  
  // Submit Button
  submitButton: { 
    marginTop: 16, 
    marginBottom: 34, 
    borderRadius: 22, 
    paddingVertical: 20, 
    paddingHorizontal: 24, 
    backgroundColor: T.primary,
    alignItems: "center",
    minHeight: 72,
    shadowColor: T.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    flexDirection: "row",
    gap: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitContent: {
    flex: 1,
  },
  submitLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  submitText: { 
    color: T.white, 
    fontSize: 18, 
    fontWeight: "900", 
    letterSpacing: 0.4,
  },
  submitSub: { 
    color: "rgba(255,255,255,0.85)", 
    fontSize: 12, 
    marginTop: 6, 
    fontWeight: "600",
    lineHeight: 18,
  },
  submitCTAIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(0,0,0,0.25)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  submitCTAIconBusy: {
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  submitCTAIconText: {
    color: T.primary,
    fontSize: 24,
    fontWeight: "900",
  },
  
  // Modal Styles
  modalOverlay: { 
    flex: 1, 
    backgroundColor: "rgba(0,0,0,0.6)", 
    justifyContent: "flex-end" 
  },
  modalContent: { 
    backgroundColor: T.surface, 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    padding: 24, 
    minHeight: 350,
  },
  modalHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 20,
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: "800", 
    color: T.text,
  },
  modalClose: { 
    fontSize: 24, 
    color: T.textTertiary, 
    fontWeight: "700",
  },
  customInput: { 
    borderWidth: 1, 
    borderColor: T.border, 
    borderRadius: 12, 
    padding: 14, 
    fontSize: 14, 
    color: T.text,
    backgroundColor: T.background,
    marginBottom: 16,
    textAlignVertical: "top",
  },
  modalButton: { 
    borderRadius: 12, 
    padding: 14, 
    backgroundColor: T.primary, 
    alignItems: "center",
    marginTop: 10,
    minHeight: 48,
    justifyContent: "center",
  },
  modalButtonDisabled: { opacity: 0.5 },
  modalButtonText: { 
    color: T.textInvert, 
    fontSize: 15, 
    fontWeight: "700",
  },
  
});
