import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../theme/useTheme";
import { fontFamily } from "../theme/tokens";

type Props = {
  score: number | null;
  size?: number;
};

export function AnimatedScoreRing({ score, size = 160 }: Props) {
  const colors = useThemeColors();
  const animatedValue = useRef(new Animated.Value(0)).current;
  const resolvedScore = typeof score === "number" ? Math.max(0, Math.min(100, score)) : null;
  const ringColor =
    resolvedScore === null ? colors.accentStrong : resolvedScore >= 80 ? colors.lime : resolvedScore >= 55 ? colors.peach : colors.danger;
  const fillHeight = useMemo(
    () =>
      animatedValue.interpolate({
        inputRange: [0, 100],
        outputRange: [0, size],
      }),
    [animatedValue, size]
  );

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: resolvedScore ?? 0,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animatedValue, resolvedScore]);

  return (
    <View
      style={[
        styles.outer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: ringColor,
          backgroundColor: colors.panelRaised,
        },
      ]}
    >
      <View style={[styles.innerClip, { borderRadius: size / 2 }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: ringColor,
              opacity: colors.canvas === "#04101B" ? 0.32 : 0.16,
              height: fillHeight,
            },
          ]}
        />
      </View>
      <Text style={[styles.value, { color: colors.heading, fontSize: Math.round(size * 0.34) }]}>{resolvedScore ?? "--"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  innerClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  value: {
    fontWeight: "900",
    fontFamily: fontFamily.display,
    letterSpacing: -1.8,
  },
});
