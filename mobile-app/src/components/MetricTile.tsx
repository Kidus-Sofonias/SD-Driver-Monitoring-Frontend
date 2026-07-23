import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { fontFamily, radius, spacing, type } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

type Props = {
  label: string;
  value: string;
};

export function MetricTile({ label, value }: Props) {
  const colors = useThemeColors();

  return (
    <View style={[styles.tile, { backgroundColor: colors.panelRaised, borderColor: colors.line }]}>
      <Text numberOfLines={2} style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <Text numberOfLines={3} style={[styles.value, { color: colors.heading }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 118,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs
  },
  label: {
    fontSize: type.micro,
    fontFamily: fontFamily.body,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  value: {
    fontSize: type.section,
    fontFamily: fontFamily.heading,
    fontWeight: "800"
  }
});
