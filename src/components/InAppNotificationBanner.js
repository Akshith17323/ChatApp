import React, { useEffect, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { motion } from '../theme/motion';
import AppleAvatar from './AppleAvatar';
import AnimatedPressable from './AnimatedPressable';

export default function InAppNotificationBanner({
  visible,
  notification,
  onPress,
  onDismiss,
}) {
  const insets = useSafeAreaInsets();
  const { colors, isDark, reduceMotion } = useAppTheme();
  const [activeNotification, setActiveNotification] = useState(visible ? notification : null);
  const [translateY] = useState(() => new Animated.Value(-160));
  const [opacity] = useState(() => new Animated.Value(0));
  const isVisible = visible && !!notification;

  if (isVisible && activeNotification !== notification) setActiveNotification(notification);
  if (!isVisible && reduceMotion && activeNotification) setActiveNotification(null);

  useEffect(() => {
    if (reduceMotion) {
      translateY.setValue(isVisible ? 0 : -160);
      opacity.setValue(isVisible ? 1 : 0);
      return;
    }

    const config = { useNativeDriver: Platform.OS !== 'web', isInteraction: false };
    const animation = Animated.parallel([
      isVisible
        ? Animated.spring(translateY, { ...motion.spring, ...config, toValue: 0 })
        : Animated.timing(translateY, { ...config, toValue: -160, duration: 180 }),
      Animated.timing(opacity, { ...config, toValue: isVisible ? 1 : 0, duration: 140 }),
    ]);
    animation.start(({ finished }) => {
      if (finished && !isVisible) setActiveNotification(null);
    });
    return () => animation.stop();
  }, [isVisible, notification, reduceMotion, translateY, opacity]);

  const currentNotif = isVisible ? notification : activeNotification;
  if (!currentNotif) return null;
  const title = currentNotif?.title || 'New Message';
  const body = currentNotif?.body || '';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 12) + 6,
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents={isVisible ? 'auto' : 'none'}
      accessibilityLiveRegion="polite"
      accessibilityElementsHidden={!isVisible}
      importantForAccessibility={isVisible ? 'auto' : 'no-hide-descendants'}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
            borderColor: colors.separator,
            shadowColor: isDark ? '#000000' : '#8E8E93',
          },
        ]}
      >
        <AnimatedPressable
          style={styles.openButton}
          onPress={onPress}
          disabled={!isVisible}
          pressScale={0.99}
          activeOpacity={0.9}
          accessibilityLabel={`New message from ${title}: ${body}`}
          accessibilityHint="Open conversation"
        >
          <AppleAvatar name={title} size={38} />
          <View style={styles.textContainer}>
            <View style={styles.headerRow}>
              <Text
                style={[styles.title, { color: colors.text }]}
                numberOfLines={1}
              >
                {title}
              </Text>
              <Text style={[styles.timeLabel, { color: colors.secondaryText }]}>
                now
              </Text>
            </View>
            <Text
              style={[styles.body, { color: colors.secondaryText }]}
              numberOfLines={2}
            >
              {body}
            </Text>
          </View>
        </AnimatedPressable>

        <AnimatedPressable
          onPress={onDismiss}
          style={styles.closeButton}
          disabled={!isVisible}
          accessibilityLabel="Dismiss notification"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name="close"
            size={18}
            color={isDark ? '#8E8E93' : '#AEAEB2'}
          />
        </AnimatedPressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
      },
      android: {
        elevation: 10,
      },
      default: {
        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12)',
      },
    }),
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  openButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1,
    marginRight: 6,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  body: {
    fontSize: 13,
    lineHeight: 17,
  },
  closeButton: {
    padding: 4,
  },
});
