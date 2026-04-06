import React, { useEffect, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { T } from "../theme";

interface StatusIndicatorProps {
  status: "loading" | "success" | "warning" | "critical" | "offline";
  count?: number;
  label?: string;
}

export default function StatusIndicator({ status, count, label }: StatusIndicatorProps) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const statusColors = {
    loading: { bg: T.primaryLight, color: T.primary, label: "Live" },
    success: { bg: T.emeraldSoft, color: T.success, label: "Resolved" },
    warning: { bg: T.amberSoft, color: T.warning, label: "Pending" },
    critical: { bg: T.criticalSoft, color: T.critical, label: "Critical" },
    offline: { bg: "#f5f5f5", color: "#999", label: "Offline" },
  };

  const statusStyle = statusColors[status];

  return (
    <View style={styles.container}>
      <View style={[styles.indicator, { backgroundColor: statusStyle.bg }]}>
        {status === "loading" && (
          <Animated.View
            style={[
              styles.pulse,
              {
                backgroundColor: statusStyle.color,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        )}
        <View
          style={[
            styles.dot,
            {
              backgroundColor: statusStyle.color,
            },
          ]}
        />
        {count !== undefined && (
          <Text style={[styles.count, { color: statusStyle.color }]}>{count}</Text>
        )}
      </View>
      {label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 6,
  },
  indicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  pulse: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.3,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    zIndex: 1,
  },
  count: {
    fontSize: 12,
    fontWeight: "700",
    zIndex: 1,
  },
  label: {
    fontSize: 10,
    color: T.textSecondary,
    fontWeight: "600",
  },
});
