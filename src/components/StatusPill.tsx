import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily, radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

type Props = {
  label: string;
  tone?: "neutral" | "good" | "warn" | "bad";
};

export function StatusPill({ label, tone = "neutral" }: Props) {
  const colors = useThemeColors();
  const backgroundStyle =
    tone === "good"
      ? { backgroundColor: "rgba(51,160,111,0.14)" }
      : tone === "warn"
        ? { backgroundColor: "rgba(207,154,54,0.16)" }
        : tone === "bad"
          ? { backgroundColor: "rgba(209,97,97,0.16)" }
          : { backgroundColor: colors.panelRaised, borderWidth: 1, borderColor: colors.line };
  const textStyle =
    tone === "good"
      ? { color: colors.lowRisk }
      : tone === "warn"
        ? { color: colors.caution }
        : tone === "bad"
          ? { color: colors.danger }
          : { color: colors.text };

  return (
    <View style={[styles.base, backgroundStyle]}>
      <Text style={[styles.label, textStyle]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6
  },
  label: {
    fontSize: type.caption,
    fontWeight: "700",
    fontFamily: fontFamily.heading,
    letterSpacing: 0.3
  },
});
