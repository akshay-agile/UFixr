import React, { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { T } from "../theme";

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  animated?: boolean;
  style?: any;
}

export default function SkeletonLoader({
  width = "100%",
  height = 16,
  borderRadius = 8,
  animated = true,
  style,
}: SkeletonLoaderProps) {
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;

    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();
  }, [animated, shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 0.8, 0.4],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity: animated ? opacity : 1,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "#e0e7ff",
  },
});
