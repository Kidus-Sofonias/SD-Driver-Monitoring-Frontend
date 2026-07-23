import React, { PropsWithChildren, useEffect, useRef } from "react";
import { Animated, Platform, StyleProp, StyleSheet, ViewStyle } from "react-native";

import { radius, spacing } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  delay?: number;
}>;

export function Card({ children, style, delay = 0 }: Props) {
  const colors = useThemeColors();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const scale = useRef(new Animated.Value(0.975)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 360,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        delay,
        friction: 9,
        tension: 70,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        delay,
        friction: 8,
        tension: 74,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, scale, translateY]);

  return (
    <Animated.View style={[styles.card, dynamicStyles(colors).card, style, { opacity, transform: [{ translateY }, { scale }] }]}>
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
      overflow: "hidden",
      ...(Platform.OS === "web"
        ? { boxShadow: colors.canvas === "#04101B" ? "0px 26px 64px rgba(0, 0, 0, 0.42)" : "0px 18px 44px rgba(8, 26, 43, 0.12)" }
        : {
            shadowColor: colors.canvas === "#04101B" ? "#000000" : "#102236",
            shadowOpacity: colors.canvas === "#04101B" ? 0.34 : 0.12,
            shadowRadius: 26,
            shadowOffset: { width: 0, height: 14 },
            elevation: 6,
          }),
    },
  });
}
