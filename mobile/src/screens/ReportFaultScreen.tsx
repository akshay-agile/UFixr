import React, { useMemo, useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import Screen from "../components/Screen";
import FormInput from "../components/FormInput";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";

const severities = [1, 2, 3, 4, 5];

export default function ReportFaultScreen() {
  const { token } = useAuth();
  const [utilityType, setUtilityType] = useState<"electricity" | "water">("electricity");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState(4);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow photo library access.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const onSubmit = async () => {
    try {
      const locationPermission = await Location.requestForegroundPermissionsAsync();
      if (locationPermission.status !== "granted") {
        Alert.alert("Location required", "Please allow location access for accurate reporting.");
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      let uploadedPhotoUrl: string | null = null;

      if (photoUri) {
        const form = new FormData();
        form.append("file", {
          uri: photoUri,
          name: "fault-photo.jpg",
          type: "image/jpeg",
        } as any);

        const uploadResponse = await apiRequest<{ photo_url: string }>("/upload", {
          method: "POST",
          body: form,
          isFormData: true,
        });
        uploadedPhotoUrl = uploadResponse.photo_url;
      }

      await apiRequest("/reports", {
        method: "POST",
        token,
        body: {
          utility_type: utilityType,
          title,
          description,
          severity,
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
          photo_url: uploadedPhotoUrl,
        },
      });

      setTitle("");
      setDescription("");
      setSeverity(4);
      setPhotoUri(null);
      Alert.alert("Success", "Your report has been submitted.");
    } catch (error) {
      Alert.alert("Submission failed", error instanceof Error ? error.message : "Unknown error");
    }
  };

  const severityColor = severity >= 4 ? T.electric : severity === 3 ? T.amber : T.emerald;

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Report fault</Text>
        <Text style={styles.subtitle}>Help your community get it fixed faster.</Text>
      </View>

      <Text style={styles.formLabel}>Utility type</Text>
      <View style={styles.typeSelector}>
        {[
          { id: "electricity", icon: "E", name: "Electricity", desc: "Power outages, wiring" },
          { id: "water", icon: "W", name: "Water", desc: "Leaks, no supply" },
        ].map((opt) => (
          <Pressable
            key={opt.id}
            onPress={() => setUtilityType(opt.id as "electricity" | "water")}
            style={[
              styles.typeOption,
              utilityType === opt.id && (opt.id === "electricity" ? styles.typeOptionElectricity : styles.typeOptionWater),
            ]}
          >
            <Text style={styles.typeEmoji}>{opt.icon}</Text>
            <Text style={styles.typeName}>{opt.name}</Text>
            <Text style={styles.typeDesc}>{opt.desc}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.formLabel}>Location</Text>
      <View style={styles.locationCard}>
        <View style={styles.locationIcon}><Text>L</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.locationTitle}>Current location</Text>
          <Text style={styles.locationAddress}>Live coordinates will be captured when you submit.</Text>
        </View>
        <Text style={styles.locationChange}>Auto</Text>
      </View>

      <Text style={styles.formLabel}>Details</Text>
      <View style={styles.formCard}>
        <FormInput label="Title" value={title} onChangeText={setTitle} placeholder="No power in our lane" />
        <FormInput label="Description" value={description} onChangeText={setDescription} placeholder="Transformer noise and full blackout" multiline />
      </View>

      <Text style={styles.formLabel}>Severity</Text>
      <View style={styles.severityCard}>
        <View style={styles.severityHeader}>
          <Text style={styles.severityTitle}>How severe is it?</Text>
          <View style={[styles.severityValue, { backgroundColor: severityColor }]}>
            <Text style={styles.severityValueText}>{severity}</Text>
          </View>
        </View>
        <View style={styles.severityRow}>
          {severities.map((value) => (
            <Pressable
              key={value}
              onPress={() => setSeverity(value)}
              style={[
                styles.severityButton,
                {
                  backgroundColor:
                    severity >= value
                      ? value >= 4
                        ? T.electric
                        : value === 3
                          ? T.amber
                          : T.emerald
                      : T.sandDeep,
                },
              ]}
            >
              <Text style={[styles.severityButtonText, { color: severity >= value ? T.white : T.inkFaint }]}>{value}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.severityLabels}>
          <Text style={styles.severityLabelText}>Minor</Text>
          <Text style={styles.severityLabelText}>Moderate</Text>
          <Text style={styles.severityLabelText}>Critical</Text>
        </View>
      </View>

      <Text style={styles.formLabel}>Evidence</Text>
      <Pressable style={styles.photoUpload} onPress={pickImage}>
        <View style={styles.photoThumb}>
          {photoUri ? <Image source={{ uri: photoUri }} style={styles.photoThumbImage} /> : <Text style={{ fontSize: 20 }}>P</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.photoTitle}>{photoUri ? "Photo added" : "Add a photo"}</Text>
          <Text style={styles.photoSub}>Helps crew assess the issue faster</Text>
        </View>
      </Pressable>

      <Pressable style={styles.submitButton} onPress={onSubmit}>
        <Text style={styles.submitText}>Submit report</Text>
        <View style={styles.submitArrow}><Text style={styles.submitArrowText}>{">"}</Text></View>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 12,
    paddingBottom: 16,
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
  formLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: T.inkFaint,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 10,
  },
  typeSelector: {
    flexDirection: "row",
    gap: 10,
  },
  typeOption: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: T.line,
    backgroundColor: T.white,
  },
  typeOptionElectricity: {
    borderColor: T.electric,
    backgroundColor: "#fff8f6",
  },
  typeOptionWater: {
    borderColor: T.water,
    backgroundColor: "#f0f4ff",
  },
  typeEmoji: {
    fontSize: 22,
    marginBottom: 6,
  },
  typeName: {
    fontSize: 13,
    fontWeight: "700",
    color: T.ink,
    marginBottom: 3,
  },
  typeDesc: {
    fontSize: 11,
    color: T.inkMuted,
    fontWeight: "300",
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: T.white,
    borderWidth: 1,
    borderColor: T.line,
  },
  locationIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: T.waterSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  locationTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: T.ink,
  },
  locationAddress: {
    fontSize: 11,
    color: T.inkMuted,
    fontWeight: "300",
  },
  locationChange: {
    fontSize: 11,
    fontWeight: "700",
    color: T.water,
  },
  formCard: {
    backgroundColor: T.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: T.line,
  },
  severityCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: T.white,
    borderWidth: 1,
    borderColor: T.line,
  },
  severityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  severityTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: T.ink,
  },
  severityValue: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  severityValueText: {
    color: T.white,
    fontWeight: "800",
    fontSize: 13,
  },
  severityRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  severityButton: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  severityButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  severityLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  severityLabelText: {
    fontSize: 10,
    color: T.inkFaint,
  },
  photoUpload: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
    borderRadius: 16,
    backgroundColor: T.white,
    borderWidth: 2,
    borderColor: T.line,
  },
  photoThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: T.sand,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoThumbImage: {
    width: "100%",
    height: "100%",
  },
  photoTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: T.ink,
    marginBottom: 3,
  },
  photoSub: {
    fontSize: 11,
    color: T.inkMuted,
    fontWeight: "300",
  },
  submitButton: {
    marginTop: 18,
    marginBottom: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    padding: 16,
    backgroundColor: T.ink,
  },
  submitText: {
    color: T.white,
    fontSize: 15,
    fontWeight: "800",
  },
  submitArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: T.electric,
    alignItems: "center",
    justifyContent: "center",
  },
  submitArrowText: {
    color: T.white,
    fontSize: 16,
    fontWeight: "700",
  },
});



