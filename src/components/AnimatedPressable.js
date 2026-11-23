import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '../context/ThemeContext';
import { motion } from '../theme/motion';

const PressableView = Animated.createAnimatedComponent(Pressable);

export default function AnimatedPressable({
  style,
  disabled = false,
  activeOpacity = 0.8,
  pressScale = 0.96,
  onPressIn,
  onPressOut,
  accessibilityRole = 'button',
  accessibilityState,
  ...props
}) {
  const { reduceMotion } = useAppTheme();
  const baseOpacity = StyleSheet.flatten(style)?.opacity ?? 1;
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: disabled || reduceMotion ? 1 : scale.get() }],
    opacity: baseOpacity * opacity.get(),
  }));

  useEffect(() => {
    scale.set(1);
    opacity.set(1);
  }, [disabled, reduceMotion, scale, opacity]);

  return (
    <PressableView
      {...props}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ ...accessibilityState, disabled }}
      aria-busy={accessibilityState?.busy}
      aria-checked={accessibilityState?.checked}
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        scale.set(reduceMotion ? 1 : withSpring(pressScale, motion.spring));
        opacity.set(reduceMotion ? activeOpacity : withTiming(activeOpacity, { duration: 80 }));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(reduceMotion ? 1 : withSpring(1, motion.spring));
        opacity.set(reduceMotion ? 1 : withTiming(1, { duration: 140 }));
        onPressOut?.(event);
      }}
    />
  );
}
