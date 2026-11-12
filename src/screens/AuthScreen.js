import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, useThemedStyles } from '../context/ThemeContext';
import { DEFAULT_BASE_URL } from '../api/config';

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
      setLocalError('Please enter both your handle and password.');
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
          <View style={styles.headerContainer}>
            <View style={styles.appIconCircle}>
              <Ionicons name="chatbubble-ellipses" size={48} color={colors.onPrimary} />
            </View>
            <Text style={styles.title}>iMessage</Text>
            <Text style={styles.subtitle}>
              Sign in to your account or create a new one automatically.
            </Text>
          </View>

          {/* Inset Grouped Card */}
          <View style={styles.groupedCard}>
            <View style={styles.inputRow}>
              <Text style={styles.rowLabel}>Handle</Text>
              <TextInput
                style={styles.rowInput}
                value={username}
                onChangeText={setUsername}
                placeholder="e.g. Alex"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
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
              />
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.inputRow}>
              <Text style={styles.rowLabel}>Server</Text>
              <TextInput
                style={styles.rowInput}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://10.7.1.51:3000"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Quick preset chips */}
          <View style={styles.presetSection}>
            <Text style={styles.presetHeader}>Quick Server Presets</Text>
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={[
                  styles.presetChip,
                  serverUrl === 'http://10.7.1.51:3000' && styles.presetChipActive,
                ]}
                onPress={() => setServerUrl('http://10.7.1.51:3000')}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    serverUrl === 'http://10.7.1.51:3000' && styles.presetChipTextActive,
                  ]}
                >
                  10.7.1.51:3000
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.presetChip,
                  serverUrl === 'http://localhost:3000' && styles.presetChipActive,
                ]}
                onPress={() => setServerUrl('http://localhost:3000')}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    serverUrl === 'http://localhost:3000' && styles.presetChipTextActive,
                  ]}
                >
                  localhost:3000
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.presetChip,
                  serverUrl === 'http://10.0.2.2:3000' && styles.presetChipActive,
                ]}
                onPress={() => setServerUrl('http://10.0.2.2:3000')}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    serverUrl === 'http://10.0.2.2:3000' && styles.presetChipTextActive,
                  ]}
                >
                  Emulator (10.0.2.2)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {(localError || error) ? (
            <View style={styles.errorBox}>
              <Ionicons name="information-circle" size={18} color={colors.danger} />
              <Text style={styles.errorBoxText}>{localError || error}</Text>
            </View>
          ) : null}

          {/* Apple Continue Button */}
          <TouchableOpacity
            style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.onPrimary} size="small" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.appleFooterNote}>
            Your user handle and chats will be synchronized securely with the NestJS backend.
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
    shadowColor: colors.appIcon,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
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
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  presetHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondaryText,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
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
    borderRadius: 14,
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
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.outgoingBubble,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
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
