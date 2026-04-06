import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { T } from "../theme";

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
};

export default function FormInput(props: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={[styles.input, props.multiline && styles.multiline]}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#cbd5e1"
        secureTextEntry={props.secureTextEntry}
        multiline={props.multiline}
        onFocus={props.onFocus}
        onBlur={props.onBlur}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    color: T.text,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: T.background,
    color: T.text,
    fontSize: 15,
    fontWeight: "500",
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 12,
  },
});
