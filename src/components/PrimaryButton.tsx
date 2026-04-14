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
      ? { backgroundColor: colors.lime, borderWidth: 1, borderColor: "rgba(199,243,107,0.36)" }
      : variant === "secondary"
        ? { backgroundColor: colors.panelRaised, borderWidth: 1, borderColor: colors.line }
        : { backgroundColor: "rgba(255,154,146,0.16)", borderWidth: 1, borderColor: "rgba(255,154,146,0.26)" };
  const labelColor =
    variant === "primary"
      ? colors.ink
      : variant === "secondary"
        ? colors.heading
        : colors.danger;

  function animateTo(pressed: boolean) {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: pressed ? 0.97 : 1,
        friction: 8,
        tension: 190,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: pressed ? 1.5 : 0,
        friction: 8,
        tension: 190,
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
          variant === "primary" ? dynamicStyles(colors).primaryGlow : dynamicStyles(colors).secondaryGlow,
          { transform: [{ scale }, { translateY }] },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variant === "primary" ? colors.ink : labelColor} />
        ) : (
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.labelBase, { color: labelColor }]}
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
    minHeight: 52,
    borderRadius: radius.pill,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg
  },
  labelBase: {
    fontSize: type.body,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.2,
    textAlign: "center",
    flexShrink: 1
  },
  disabled: {
    opacity: 0.45
  }
});

function dynamicStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    primaryGlow: {
      shadowColor: colors.lime,
      shadowOpacity: 0.24,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 5,
    },
    secondaryGlow: {
      shadowColor: colors.canvas === "#04101B" ? "#000000" : colors.accentStrong,
      shadowOpacity: colors.canvas === "#04101B" ? 0.16 : 0.1,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
  });
}
