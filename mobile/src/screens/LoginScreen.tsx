import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import Screen from "../components/Screen";
import FormInput from "../components/FormInput";
import { useAuth } from "../context/AuthContext";
import { T } from "../theme";
import BrandLogo from "../components/BrandLogo";

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter phone number and password");
      return;
    }
    try {
      setIsLoading(true);
      await login(phone, password);
    } catch (error) {
      Alert.alert("Login failed", error instanceof Error ? error.message : "Unknown error");
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
          <Text style={styles.title}>UFixr</Text>
          <Text style={styles.subtitle}>Citizen Access Portal</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <View style={styles.formCard}>
            <FormInput 
              label="Phone" 
              value={phone} 
              onChangeText={setPhone} 
              placeholder="Enter your phone number"
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
            />
            <FormInput 
              label="Password" 
              value={password} 
              onChangeText={setPassword} 
              secureTextEntry 
              placeholder="••••••••"
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
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
              <Text style={styles.submitButtonText}>Access Portal</Text>
            )}
          </Pressable>

          <Text style={styles.divider}>or</Text>

          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Register")}>
            <Text style={styles.secondaryButtonText}>Create New Account</Text>
          </Pressable>
        </View>

        {/* Footer Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Report utility faults in your area</Text>
          <Text style={styles.footerText}>Track updates from dispatch</Text>
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
  divider: {
    textAlign: "center",
    color: T.textTertiary,
    fontSize: 12,
    fontWeight: "600",
    marginVertical: 4,
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





