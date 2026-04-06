import React, { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";

interface AnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
  style?: any;
}

export default function AnimatedCard({ children, delay = 0, style }: AnimatedCardProps) {
  const slideAnim = React.useRef(new Animated.Value(50)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, slideAnim, fadeAnim]);

  return (
    <Animated.View
      style={[
        {
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
