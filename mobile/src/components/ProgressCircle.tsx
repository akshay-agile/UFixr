import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { T } from "../theme";

interface ProgressCircleProps {
  value: number; // 0-100
  size?: number;
  thickness?: number;
  label?: string;
  color?: string;
}

export default function ProgressCircle({
  value,
  size = 60,
  thickness = 4,
  label,
  color,
}: ProgressCircleProps) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  // Color based on value if not provided
  const displayColor = color || (value >= 75 ? T.critical : value >= 50 ? T.warning : T.success);

  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <View style={{ position: "relative", width: size, height: size }}>
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: thickness,
            borderColor: "#eee",
          }}
        />
        <View
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: thickness,
            borderColor: displayColor,
            borderTopColor: displayColor,
            borderRightColor: displayColor,
            borderBottomColor: "transparent",
            borderLeftColor: "transparent",
            transform: [{ rotate: `${(value / 100) * 360}deg` }],
          }}
        />
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "800", color: displayColor }}>
            {Math.round(value)}%
          </Text>
        </View>
      </View>
      {label && (
        <Text style={{ fontSize: 12, fontWeight: "600", color: T.textSecondary }}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({});
