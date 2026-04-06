import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";
import { T } from "../theme";

const THUMB_SIZE = 26;
const STEP_LABELS = ["Calm", "Watch", "Elevated", "High", "Critical"];

type SeveritySliderProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
};

export default function SeveritySlider({ value, onChange, min = 1, max = 5 }: SeveritySliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useRef(new Animated.Value((value - min) / (max - min))).current;
  const trackAnimated = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: (value - min) / (max - min),
      useNativeDriver: false,
      damping: 18,
      stiffness: 140,
    }).start();
  }, [value, min, max, progress]);

  useEffect(() => {
    trackAnimated.setValue(trackWidth || 1);
  }, [trackWidth, trackAnimated]);

  const updateFromLocation = (locationX: number) => {
    if (!trackWidth) return;
    const ratio = locationX / trackWidth;
    const raw = Math.round(min + ratio * (max - min));
    const clamped = Math.min(max, Math.max(min, raw));
    if (clamped !== value) {
      onChange(clamped);
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => updateFromLocation(evt.nativeEvent.locationX),
        onPanResponderMove: (evt) => updateFromLocation(evt.nativeEvent.locationX),
      }),
    [trackWidth, value]
  );

  const ticks = useMemo(() => Array.from({ length: max - min + 1 }, (_, idx) => idx + min), [min, max]);

  const thumbTranslate = Animated.subtract(Animated.multiply(progress, trackAnimated), THUMB_SIZE / 2);
  const fillWidth = Animated.multiply(progress, trackAnimated);

  return (
    <View>
      <View
        style={styles.trackContainer}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <Animated.View style={[styles.trackFill, { width: fillWidth }]} />
        <View style={styles.trackBase} />
        <Animated.View style={[styles.thumb, { transform: [{ translateX: thumbTranslate }] }]} />
      </View>
      <View style={styles.tickRow}>
        {ticks.map((tick, index) => {
          const active = tick <= value;
          return (
            <View key={tick} style={styles.tickItem}>
              <View style={[styles.tickDot, active && styles.tickDotActive]} />
              <Text style={[styles.tickLabel, tick === value && styles.tickLabelActive]}>
                {STEP_LABELS[index] ?? `S${tick}`}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trackContainer: {
    height: 36,
    borderRadius: 18,
    backgroundColor: T.borderLight,
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: THUMB_SIZE / 2,
  },
  trackBase: {
    position: "absolute",
    left: THUMB_SIZE / 2,
    right: THUMB_SIZE / 2,
    height: 6,
    borderRadius: 999,
    backgroundColor: T.border,
  },
  trackFill: {
    position: "absolute",
    left: THUMB_SIZE / 2,
    height: 6,
    borderRadius: 999,
    backgroundColor: T.electric,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: T.white,
    borderWidth: 3,
    borderColor: T.electric,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  tickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  tickItem: {
    alignItems: "center",
    flex: 1,
  },
  tickDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.border,
    marginBottom: 4,
    alignSelf: "center",
  },
  tickDotActive: {
    backgroundColor: T.electric,
  },
  tickLabel: {
    fontSize: 10,
    color: T.textSecondary,
    fontWeight: "600",
  },
  tickLabelActive: {
    color: T.electric,
  },
});
