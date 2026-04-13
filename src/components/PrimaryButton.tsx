import React, { useRef } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text } from "react-native";

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
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const variantStyle =
    variant === "primary"
      ? { backgroundColor: colors.accentDeep, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }
      : variant === "secondary"
        ? { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line }
        : { backgroundColor: colors.danger, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" };
  const labelStyle = variant === "secondary" ? styles.labelSecondary : styles.labelPrimary;

  function animateTo(pressed: boolean) {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: pressed ? 0.975 : 1,
        friction: 7,
        tension: 180,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: pressed ? 1 : 0,
        friction: 7,
        tension: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={() => animateTo(true)}
      onPressOut={() => animateTo(false)}
      style={disabled ? styles.disabled : undefined}
    >
      <Animated.View
        style={[
          styles.base,
          variantStyle,
          variant === "primary" ? styles.primaryGlow : null,
          { transform: [{ scale }, { translateY }] },
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
      </Animated.View>
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
  primaryGlow: {
    shadowColor: "#081A2B",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  disabled: {
    opacity: 0.45
  }
});
