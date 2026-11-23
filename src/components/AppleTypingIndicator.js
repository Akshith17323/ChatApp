import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, Text, AppState, Platform } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';
import AppleAvatar from './AppleAvatar';

export default function AppleTypingIndicator({ userName, colors: propColors, isDark: propIsDark }) {
  const theme = useAppTheme();
  const colors = propColors || theme.colors;
  const isDark = propIsDark !== undefined ? propIsDark : theme.isDark;
  const { reduceMotion } = theme;
  const [isActive, setIsActive] = useState(!AppState.currentState || AppState.currentState === 'active');

  const [dot1] = useState(() => new Animated.Value(0));
  const [dot2] = useState(() => new Animated.Value(0));
  const [dot3] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setIsActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    [dot1, dot2, dot3].forEach((dot) => dot.setValue(0));
    if (reduceMotion || !isActive) return;

    const config = { useNativeDriver: Platform.OS !== 'web', isInteraction: false };
    const createPulse = (dot, delay) => {
      return Animated.sequence([
        Animated.timing(dot, { ...config, toValue: 0, duration: 0, delay }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(dot, {
              ...config,
              toValue: -3,
              duration: 280,
            }),
            Animated.timing(dot, {
              ...config,
              toValue: 0,
              duration: 280,
            }),
            Animated.timing(dot, { ...config, toValue: 0, duration: 440 }),
          ])
        ),
      ]);
    };

    const anim1 = createPulse(dot1, 0);
    const anim2 = createPulse(dot2, 160);
    const anim3 = createPulse(dot3, 320);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3, reduceMotion, isActive]);

  const dotColor = isDark ? '#AEAEB2' : '#8E8E93';
  const bubbleBg = isDark ? '#2C2C2E' : '#E9E9EB';

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`${userName || 'Someone'} is typing`}
      accessibilityLiveRegion="polite"
    >
      <AppleAvatar name={userName || 'User'} size={28} />
      <View style={styles.contentColumn}>
        <View style={[styles.bubble, { backgroundColor: bubbleBg }]}>
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: dotColor, transform: [{ translateY: dot1 }] },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: dotColor, transform: [{ translateY: dot2 }] },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              { backgroundColor: dotColor, transform: [{ translateY: dot3 }] },
            ]}
          />
        </View>
        <Text style={[styles.label, { color: colors.secondaryText }]}>
          {userName || 'Someone'} is typing…
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 4,
  },
  contentColumn: {
    marginLeft: 8,
    alignItems: 'flex-start',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 3,
    marginLeft: 4,
    letterSpacing: -0.1,
  },
});
