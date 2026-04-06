import React, { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { T } from "../theme";

type SuccessModalProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onHide?: () => void;
};

export default function SuccessModal({ visible, title, subtitle, onHide }: SuccessModalProps) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 200 }),
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.7);
      opacity.setValue(0);
    }
  }, [visible, opacity, scale]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onHide}>
        <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
          <View style={styles.iconBubble}>
            <Text style={styles.icon}>✅</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: T.surface,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  iconBubble: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: T.electricSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: T.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: T.textSecondary,
    marginTop: 8,
    textAlign: "center",
  },
});
