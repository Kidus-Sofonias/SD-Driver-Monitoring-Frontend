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
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const resolvedScore = typeof score === "number" ? Math.max(0, Math.min(100, score)) : null;

  const ringColor =
    resolvedScore === null ? colors.accentStrong : resolvedScore >= 80 ? colors.lime : resolvedScore >= 55 ? colors.peach : colors.danger;

  // Segmented background bands: red, amber, green
  const bandSegments = useMemo(
    () => [
      { from: 0, to: 40, color: colors.highRisk },
      { from: 40, to: 60, color: colors.caution },
      { from: 60, to: 100, color: colors.lowRisk },
    ],
    [colors]
  );

  // Scale animation: pop in on mount
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  // Fill animation: grows from bottom
  useEffect(() => {
    Animated.sequence([
      Animated.delay(120),
      Animated.timing(animatedValue, {
        toValue: resolvedScore ?? 0,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [animatedValue, resolvedScore]);

  const fillHeight = useMemo(
    () =>
      animatedValue.interpolate({
        inputRange: [0, 100],
        outputRange: [0, size],
      }),
    [animatedValue, size]
  );

  // Segmented arc: maps each band as a horizontal bar at its proportional height
  const bandLayouts = useMemo(() => {
    if (!size) {
      return bandSegments.map(() => ({ height: 0, bottom: 0 }));
    }
    return bandSegments.map((band) => {
      const rawHeight = ((band.to - band.from) / 100) * size;
      return {
        height: rawHeight < 4 ? 4 : rawHeight,
        bottom: (band.from / 100) * size,
      };
    });
  }, [bandSegments, size]);

  return (
    <Animated.View
      style={[
        styles.outer,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: ringColor,
          backgroundColor: colors.panelRaised,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Segmented background bands */}
      {resolvedScore !== null
        ? bandSegments.map((band, index) => (
            <View
              key={`band-${band.from}`}
              style={[
                styles.band,
                {
                  left: 10,
                  right: 10,
                  height: bandLayouts[index].height,
                  bottom: bandLayouts[index].bottom,
                  backgroundColor: band.color,
                  opacity: 0.18,
                  borderTopLeftRadius: index === bandSegments.length - 1 ? size / 2 : 0,
                  borderTopRightRadius: index === bandSegments.length - 1 ? size / 2 : 0,
                },
              ]}
            />
          ))
        : null}

      {/* Animated fill overlay */}
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

      <Text style={[styles.value, { color: colors.heading, fontSize: Math.round(size * 0.34) }]}>
        {resolvedScore ?? "--"}
      </Text>
    </Animated.View>
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
  band: {
    position: "absolute",
  },
  value: {
    fontWeight: "900",
    fontFamily: fontFamily.display,
    letterSpacing: -1.8,
  },
});
