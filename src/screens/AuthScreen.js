import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, useThemedStyles } from '../context/ThemeContext';
import { DEFAULT_BASE_URL, SERVER_PRESETS } from '../api/config';
import AnimatedPressable from '../components/AnimatedPressable';
import { motion } from '../theme/motion';

const ANDROID_EMULATOR_PRESET = { label: 'Emulator (10.0.2.2)', url: 'http://10.0.2.2:3000' };
const ALL_PRESETS = Platform.OS === 'android'
  ? [...SERVER_PRESETS, ANDROID_EMULATOR_PRESET]
  : SERVER_PRESETS;

export default function AuthScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { login, isLoading, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState(DEFAULT_BASE_URL);
  const [localError, setLocalError] = useState('');

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setLocalError('Enter your username and password.');
      return;
    }
    setLocalError('');
    try {
      await login(username, password, serverUrl);
    } catch (err) {
      setLocalError(err.message || 'Connection failed.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Apple Messages Icon & Header */}
          <Animated.View entering={motion.enter} style={styles.headerContainer}>
            <View style={styles.appIconCircle}>
              <Ionicons name="chatbubble-ellipses" size={48} color={colors.onPrimary} />
            </View>
            <Text style={styles.title}>Messages</Text>
            <Text style={styles.subtitle}>
              Sign in with your username and password.
            </Text>
          </Animated.View>

          {/* Inset Grouped Card */}
          <Animated.View entering={motion.enter} style={styles.groupedCard}>
            <View style={styles.inputRow}>
              <Text style={styles.rowLabel}>Username</Text>
              <TextInput
                style={styles.rowInput}
                value={username}
                onChangeText={setUsername}
                placeholder="e.g. Alex"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Username"
              />
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.inputRow}>
              <Text style={styles.rowLabel}>Password</Text>
              <TextInput
                style={styles.rowInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Required"
                placeholderTextColor={colors.placeholder}
                secureTextEntry
                accessibilityLabel="Password"
              />
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.inputRow}>
              <Text style={styles.rowLabel}>Server</Text>
              <TextInput
                style={styles.rowInput}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://your-server:3000"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Server URL"
              />
            </View>
          </Animated.View>

          {/* Quick preset chips */}
          {ALL_PRESETS.length > 0 && (
            <View style={styles.presetSection}>
              <Text style={styles.presetHeader}>Server presets</Text>
              <View style={styles.presetRow}>
                {ALL_PRESETS.map((preset) => (
                  <AnimatedPressable
                    key={preset.url}
                    style={[
                      styles.presetChip,
                      serverUrl === preset.url && styles.presetChipActive,
                    ]}
                    onPress={() => setServerUrl(preset.url)}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        serverUrl === preset.url && styles.presetChipTextActive,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </AnimatedPressable>
                ))}
              </View>
            </View>
          )}

          {(localError || error) ? (
            <Animated.View entering={motion.enter} exiting={motion.exit} style={styles.errorBox} accessibilityLiveRegion="polite">
              <Ionicons name="information-circle" size={18} color={colors.danger} />
              <Text style={styles.errorBoxText}>{localError || error}</Text>
            </Animated.View>
          ) : null}

          {/* Apple Continue Button */}
          <AnimatedPressable
            style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
            accessibilityState={{ busy: isLoading }}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </AnimatedPressable>

          <Text style={styles.appleFooterNote}>
            Your chats are synchronized with your selected server.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.groupedBackground,
  },
  keyboardContainer: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 24,
    justifyContent: 'center',
    flexGrow: 1,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  appIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.appIcon,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.secondaryText,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  groupedCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowLabel: {
    width: 90,
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  rowInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  presetSection: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  presetHeader: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.secondaryText,
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    backgroundColor: colors.input,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  presetChipText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  presetChipTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorBoxText: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
  },
  continueButton: {
    backgroundColor: colors.outgoingBubble,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: colors.onPrimary,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  appleFooterNote: {
    fontSize: 12,
    color: colors.secondaryText,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 16,
    paddingHorizontal: 20,
  },
});
