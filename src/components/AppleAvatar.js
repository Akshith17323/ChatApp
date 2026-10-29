import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Apple Messages contact avatar colors
const AVATAR_COLORS = [
  '#007AFF', // Blue
  '#34C759', // Green
  '#5856D6', // Indigo
  '#AF52DE', // Purple
  '#FF2D55', // Pink
  '#FF9500', // Orange
  '#5AC8FA', // Teal
  '#8E8E93', // Gray
];

function getColorForString(str = '') {
  if (!str) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitials(name = '') {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AppleAvatar({
  name = '',
  size = 48,
  isGroup = false,
  memberCount = 0,
}) {
  const bgColor = getColorForString(name);
  const initials = getInitials(name);
  const fontSize = Math.floor(size * 0.4);

  if (isGroup) {
    const subSize = Math.floor(size * 0.68);
    const subFontSize = Math.floor(subSize * 0.38);

    return (
      <View style={[styles.groupContainer, { width: size, height: size }]}>
        {/* Back circle */}
        <View
          style={[
            styles.avatarCircle,
            styles.groupCircleBack,
            {
              width: subSize,
              height: subSize,
              borderRadius: subSize / 2,
              backgroundColor: '#5856D6',
            },
          ]}
        >
          <Ionicons name="people" size={subFontSize + 2} color="#FFFFFF" />
        </View>
        {/* Front circle */}
        <View
          style={[
            styles.avatarCircle,
            styles.groupCircleFront,
            {
              width: subSize,
              height: subSize,
              borderRadius: subSize / 2,
              backgroundColor: '#007AFF',
            },
          ]}
        >
          <Text style={[styles.initialsText, { fontSize: subFontSize }]}>
            {memberCount > 0 ? memberCount : 'G'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.avatarCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Text style={[styles.initialsText, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  groupContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupCircleBack: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  groupCircleFront: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

