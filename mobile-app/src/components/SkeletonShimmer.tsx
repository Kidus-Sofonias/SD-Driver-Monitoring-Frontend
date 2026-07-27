import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";



import { radius, spacing } from "../theme/tokens";
import { useThemeColors } from "../theme/useTheme";

type Props = {
  height?: number;
  borderRadius?: number;
  style?: any;
};

export function SkeletonLine({ height = 16, borderRadius: customRadius, style }: Props) {
  const colors = useThemeColors();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.35],
  });

  return (
    <Animated.View
      style={[
        styles.line,
        {
          height,
          borderRadius: customRadius ?? radius.sm,
          backgroundColor: colors.line,
          opacity,
        },
        style,
      ]}
    />
  );
}

type SkeletonCardProps = {
  lines?: number;
  style?: any;
};

export function SkeletonCard({ lines = 4, style }: SkeletonCardProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.line }, style]}>
      <SkeletonLine style={{ width: "40%" }} height={14} />
      <SkeletonLine style={{ width: "70%" }} height={20} />
      {Array.from({ length: lines - 2 }).map((_, index) => (
        <SkeletonLine key={index} style={{ width: `${50 + Math.random() * 40}%` } as React.CSSProperties} height={14} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  line: {
    borderRadius: radius.sm,
  },
});
