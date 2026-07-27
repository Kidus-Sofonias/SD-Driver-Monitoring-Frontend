import React, { PropsWithChildren, useEffect, useRef } from "react";
import { Animated, Easing, StyleProp, ViewStyle } from "react-native";

type RevealProps = PropsWithChildren<{
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}>;

type FloatingOrbProps = {
  children?: React.ReactNode;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  xRange?: [number, number];
  yRange?: [number, number];
  scaleRange?: [number, number];
};

export function Reveal({
  children,
  delay = 0,
  distance = 18,
  duration = 520,
  style,
}: RevealProps) {
  const entry = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    entry.setValue(0);
    Animated.timing(entry, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.poly(4)),
      useNativeDriver: false,
    }).start();
  }, [delay, distance, duration, entry]);

  const opacity = entry.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const translateY = entry.interpolate({
    inputRange: [0, 1],
    outputRange: [distance, 0],
  });

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

export function FloatingOrb({
  children,
  duration = 8200,
  style,
  xRange = [-8, 8],
  yRange = [-10, 12],
  scaleRange = [0.97, 1.05],
}: FloatingOrbProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [duration, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: xRange,
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: yRange,
  });
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: scaleRange,
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.32, 0.74, 0.42],
  });

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateX }, { translateY }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}
