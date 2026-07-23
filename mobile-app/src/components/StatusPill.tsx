import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";

import { fontFamily, radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

type Props = {
  label: string;
  tone?: "neutral" | "good" | "warn" | "bad";
};

export function StatusPill({ label, tone = "neutral" }: Props) {
  const colors = useThemeColors();
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const backgroundStyle =
    tone === "good"
      ? { backgroundColor: "rgba(109,226,161,0.14)", borderWidth: 1, borderColor: "rgba(109,226,161,0.2)" }
      : tone === "warn"
        ? { backgroundColor: "rgba(255,183,128,0.14)", borderWidth: 1, borderColor: "rgba(255,183,128,0.2)" }
        : tone === "bad"
          ? { backgroundColor: "rgba(255,154,146,0.14)", borderWidth: 1, borderColor: "rgba(255,154,146,0.18)" }
          : { backgroundColor: colors.panelRaised, borderWidth: 1, borderColor: colors.line };
  const textStyle =
    tone === "good"
      ? { color: colors.lowRisk }
      : tone === "warn"
        ? { color: colors.caution }
        : tone === "bad"
          ? { color: colors.danger }
          : { color: colors.text };

  // Spring animation on mount and when label changes
  useEffect(() => {
    scaleAnim.setValue(0.88);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }, [label, tone, scaleAnim]);

  return (
    <Animated.View style={[styles.base, backgroundStyle, { transform: [{ scale: scaleAnim }] }]}>
      <Text style={[styles.label, textStyle]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7
  },
  label: {
    fontSize: type.caption,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.3
  },
});
