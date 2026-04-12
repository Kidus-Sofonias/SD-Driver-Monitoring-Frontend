import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { fontFamily, radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, loading, variant = "primary", disabled }: Props) {
  const colors = useThemeColors();
  const variantStyle =
    variant === "primary"
      ? { backgroundColor: colors.accentDeep, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }
      : variant === "secondary"
        ? { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line }
        : { backgroundColor: colors.danger, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" };
  const labelStyle = variant === "secondary" ? styles.labelSecondary : styles.labelPrimary;

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? colors.accentDeep : colors.mist} />
      ) : (
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[styles.labelBase, labelStyle, variant === "secondary" ? { color: colors.accentDeep } : { color: colors.mist }]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: radius.pill,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.md
  },
  labelBase: {
    fontSize: type.body,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.2,
    textAlign: "center",
    flexShrink: 1
  },
  labelPrimary: {},
  labelSecondary: {},
  pressed: {
    opacity: 0.92,
    transform: [{ translateY: 1 }]
  },
  disabled: {
    opacity: 0.45
  }
});
