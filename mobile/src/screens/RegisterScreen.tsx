import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
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

  const onSubmit = async () => {
    try {
      await register(name, phone, password);
    } catch (error) {
      Alert.alert("Registration failed", error instanceof Error ? error.message : "Unknown error");
    }
  };

  return (
    <Screen>
      <View style={styles.headerCard}>
        <BrandLogo size={70} />
        <Text style={styles.kicker}>Get started</Text>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Stay notified when crews acknowledge, start, and resolve nearby faults.</Text>
      </View>

      <View style={styles.formCard}>
        <FormInput label="Name" value={name} onChangeText={setName} placeholder="Akshay" />
        <FormInput label="Phone" value={phone} onChangeText={setPhone} placeholder="9876543210" />
        <FormInput label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Pressable style={styles.button} onPress={onSubmit}>
          <Text style={styles.buttonText}>Register</Text>
          <View style={styles.arrowBox}><Text style={styles.arrow}>{">"}</Text></View>
        </Pressable>
      </View>

      <Pressable style={styles.linkWrap} onPress={() => navigation.goBack()}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    marginTop: 20,
    marginBottom: 18,
    backgroundColor: T.ink,
    borderRadius: 22,
    padding: 22,
  },
  kicker: {
    fontSize: 10,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: T.white,
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.72)",
  },
  formCard: {
    backgroundColor: T.white,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: T.line,
  },
  button: {
    marginTop: 8,
    borderRadius: 16,
    padding: 16,
    backgroundColor: T.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  buttonText: {
    color: T.white,
    fontSize: 16,
    fontWeight: "800",
  },
  arrowBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: T.electric,
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: {
    color: T.white,
    fontSize: 16,
    fontWeight: "800",
  },
  linkWrap: {
    alignItems: "center",
    marginTop: 18,
  },
  link: {
    color: T.inkSoft,
    fontWeight: "600",
  },
});





