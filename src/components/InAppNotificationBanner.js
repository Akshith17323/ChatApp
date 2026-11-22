import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import AppleAvatar from './AppleAvatar';

export default function InAppNotificationBanner({
  visible,
  notification,
  onPress,
  onDismiss,
}) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const translateY = useRef(new Animated.Value(-150)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && notification) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 70,
          friction: 9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -150,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, notification, translateY, opacity]);

  if (!visible && opacity._value === 0) {
    return null;
  }

  const title = notification?.title || 'New Message';
  const body = notification?.body || '';

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
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
            borderColor: colors.separator,
            shadowColor: isDark ? '#000000' : '#8E8E93',
          },
        ]}
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

        <TouchableOpacity
          onPress={onDismiss}
          style={styles.closeButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name="close"
            size={18}
            color={isDark ? '#8E8E93' : '#AEAEB2'}
          />
        </TouchableOpacity>
      </TouchableOpacity>
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
