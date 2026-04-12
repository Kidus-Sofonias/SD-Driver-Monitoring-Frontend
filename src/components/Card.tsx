import React, { PropsWithChildren, useEffect, useRef } from "react";
import { Animated, Platform, StyleProp, StyleSheet, ViewStyle } from "react-native";

import { radius, spacing } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function Card({ children, style }: Props) {
  const colors = useThemeColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 9,
        tension: 70,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View style={[styles.card, dynamicStyles(colors).card, style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  }
});

function dynamicStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.panel,
      borderColor: colors.line,
      borderWidth: 1,
      ...(Platform.OS === "web"
        ? { boxShadow: colors.canvas === "#08111C" ? "0px 24px 48px rgba(0, 0, 0, 0.30)" : "0px 18px 40px rgba(16, 34, 54, 0.08)" }
        : {
            shadowColor: colors.canvas === "#08111C" ? "#000000" : "#102236",
            shadowOpacity: colors.canvas === "#08111C" ? 0.24 : 0.09,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 12 },
            elevation: 4,
          }),
    },
  });
}
