import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import Screen from "../components/Screen";
import FormInput from "../components/FormInput";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";
import BrandLogo from "../components/BrandLogo";

export default function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async () => {
    if (!name.trim() || !phone.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please fill in all fields");
      return;
    }
    try {
      setIsLoading(true);
      await register(name, phone, password);
    } catch (error) {
      Alert.alert("Registration failed", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <BrandLogo size={56} />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the UFixr community</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <View style={styles.formCard}>
            <FormInput 
              label="Your Name" 
              value={name} 
              onChangeText={setName} 
              placeholder="e.g., Akshay Kumar"
            />
            <FormInput 
              label="Phone Number" 
              value={phone} 
              onChangeText={setPhone} 
              placeholder="987654321"
            />
            <FormInput 
              label="Password" 
              value={password} 
              onChangeText={setPassword} 
              secureTextEntry 
              placeholder="••••••••"
            />
          </View>

          <Pressable 
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]} 
            onPress={onSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={T.textInvert} size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Create Account</Text>
            )}
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.secondaryButtonText}>Already have an account? Login</Text>
          </Pressable>
        </View>

        {/* Footer Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Report utility faults in your area</Text>
          <Text style={styles.footerText}>Help your community stay informed</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    padding: 24,
  },
  headerSection: {
    alignItems: "center",
    marginTop: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: T.text,
    marginTop: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: T.textSecondary,
    marginTop: 6,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  formSection: {
    gap: 16,
  },
  formCard: {
    backgroundColor: T.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: T.border,
    gap: 4,
  },
  submitButton: {
    backgroundColor: T.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: T.textInvert,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  secondaryButton: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: T.border,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: T.primary,
    fontSize: 15,
    fontWeight: "700",
  },
  footer: {
    alignItems: "center",
    gap: 4,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: T.textTertiary,
    fontWeight: "500",
  },
});





