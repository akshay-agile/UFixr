import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from "react-native";
import { T } from "../theme";

type Chip = {
  label: string;
  meta?: string;
};

type AutoSuggestionChipsProps = {
  suggestions: Chip[];
  onSelect?: (label: string) => void;
  style?: ViewStyle;
};

export default function AutoSuggestionChips({ suggestions, onSelect, style }: AutoSuggestionChipsProps) {
  if (!suggestions.length) {
    return null;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.wrapper, style]}>
      {suggestions.map((chip) => (
        <Pressable key={chip.label} onPress={() => onSelect?.(chip.label)} style={styles.chip}>
          <Text style={styles.chipLabel}>{chip.label}</Text>
          {chip.meta ? <Text style={styles.chipMeta}>{chip.meta}</Text> : null}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 10,
    paddingVertical: 4,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: T.text,
  },
  chipMeta: {
    fontSize: 10,
    fontWeight: "600",
    color: T.textSecondary,
    marginTop: 2,
  },
});
