import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, useThemedStyles } from '../context/ThemeContext';
import { userApi } from '../api/userApi';
import AppleAvatar from '../components/AppleAvatar';
import AnimatedPressable from '../components/AnimatedPressable';
import { motion } from '../theme/motion';

const APPEARANCE_OPTIONS = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const { colors, themeMode, setThemeMode, storageError } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { user, username, baseUrl, setServerUrl, logout } = useAuth();
  const [editingUrl, setEditingUrl] = useState(baseUrl);
  const [testingPing, setTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  const handleSaveUrl = () => {
    if (!editingUrl.trim()) return;
    setServerUrl(editingUrl.trim());
    Alert.alert('Server Updated', `Active backend URL set to:\n${editingUrl.trim()}`);
  };

  const handleTestConnection = async () => {
    setTestingPing(true);
    setPingResult(null);
    try {
      const res = await userApi.getUserProfile();
      setPingResult({
        success: true,
        message: `Connected! Authenticated as "${res.name}"`,
      });
    } catch (err) {
      setPingResult({
        success: false,
        message: `Offline: ${err.message}`,
      });
    } finally {
      setTestingPing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.ScrollView
        entering={motion.fade}
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.largeTitle}>Settings</Text>

        {/* Apple ID Style Profile Card */}
        <View style={styles.groupedCard}>
          <View style={styles.profileRow}>
            <AppleAvatar name={user?.name || username || 'User'} size={56} />
            <View style={styles.profileTextCol}>
              <Text style={styles.profileName}>
                {user?.name || username || 'Not Signed In'}
              </Text>
              <Text style={styles.profileSubtext}>
                {user?.id ? `ID: ${user.id}` : 'Local Profile'}
              </Text>
              {user?.bio ? (
                <Text style={styles.profileBio} numberOfLines={1}>
                  {user.bio}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} />
          </View>
        </View>

        <Text style={styles.sectionHeader}>Appearance</Text>
        <View style={styles.groupedCard} accessibilityRole="radiogroup">
          {APPEARANCE_OPTIONS.map((option, index) => (
            <React.Fragment key={option.value}>
              {index > 0 && <View style={styles.rowDivider} />}
              <AnimatedPressable
                style={styles.appearanceRow}
                onPress={() => setThemeMode(option.value)}
                accessibilityRole="radio"
                accessibilityLabel={`${option.label} appearance`}
                accessibilityState={{ checked: themeMode === option.value }}
                activeOpacity={0.6}
                pressScale={0.99}
              >
                <Ionicons name={option.icon} size={21} color={colors.primary} />
                <Text style={styles.appearanceLabel}>{option.label}</Text>
                {themeMode === option.value && (
                  <Animated.View entering={motion.pop}>
                    <Ionicons name="checkmark" size={21} color={colors.primary} />
                  </Animated.View>
                )}
              </AnimatedPressable>
            </React.Fragment>
          ))}
        </View>
        <Text style={styles.appearanceNote}>
          {storageError || 'System follows your device. Your selection is saved on this device.'}
        </Text>

        {/* Server Configuration Section */}
        <Text style={styles.sectionHeader}>Server</Text>
        <View style={styles.groupedCard}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>URL</Text>
            <TextInput
              style={styles.fieldInput}
              value={editingUrl}
              onChangeText={setEditingUrl}
              placeholder="http://10.7.1.51:3000"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.rowDivider} />

          <AnimatedPressable
            style={styles.actionRow}
            onPress={handleSaveUrl}
            activeOpacity={0.6}
          >
            <Text style={styles.actionRowText}>Apply server URL</Text>
            <Ionicons name="cloud-upload-outline" size={19} color={colors.primary} />
          </AnimatedPressable>

          <View style={styles.rowDivider} />

          <AnimatedPressable
            style={styles.actionRow}
            onPress={handleTestConnection}
            disabled={testingPing}
            activeOpacity={0.6}
            accessibilityState={{ busy: testingPing }}
          >
            <Text style={styles.actionRowText}>Test connection</Text>
            {testingPing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="pulse-outline" size={19} color={colors.primary} />
            )}
          </AnimatedPressable>
        </View>

        {/* Quick presets */}
        <View style={styles.presetsRow}>
          <AnimatedPressable
            style={[
              styles.presetChip,
              editingUrl === 'http://10.7.1.51:3000' && styles.presetChipActive,
            ]}
            onPress={() => setEditingUrl('http://10.7.1.51:3000')}
          >
            <Text
              style={[
                styles.presetChipText,
                editingUrl === 'http://10.7.1.51:3000' && styles.presetChipTextActive,
              ]}
            >
              10.7.1.51:3000
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[
              styles.presetChip,
              editingUrl === 'http://localhost:3000' && styles.presetChipActive,
            ]}
            onPress={() => setEditingUrl('http://localhost:3000')}
          >
            <Text
              style={[
                styles.presetChipText,
                editingUrl === 'http://localhost:3000' && styles.presetChipTextActive,
              ]}
            >
              localhost:3000
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[
              styles.presetChip,
              editingUrl === 'http://10.0.2.2:3000' && styles.presetChipActive,
            ]}
            onPress={() => setEditingUrl('http://10.0.2.2:3000')}
          >
            <Text
              style={[
                styles.presetChipText,
                editingUrl === 'http://10.0.2.2:3000' && styles.presetChipTextActive,
              ]}
            >
              Emulator (10.0.2.2)
            </Text>
          </AnimatedPressable>
        </View>

        {pingResult && (
          <Animated.View
            entering={motion.enter}
            exiting={motion.exit}
            accessibilityLiveRegion="polite"
            style={[
              styles.statusBanner,
              pingResult.success ? styles.successBanner : styles.errorBanner,
            ]}
          >
            <Ionicons
              name={pingResult.success ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={pingResult.success ? colors.success : colors.danger}
            />
            <Text
              style={[
                styles.statusBannerText,
                pingResult.success ? styles.successText : styles.errorText,
              ]}
            >
              {pingResult.message}
            </Text>
          </Animated.View>
        )}

        {/* Account Section */}
        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.groupedCard}>
          <AnimatedPressable
            style={styles.dangerRow}
            onPress={logout}
            activeOpacity={0.6}
          >
            <Text style={styles.dangerRowText}>Sign out</Text>
          </AnimatedPressable>
        </View>

        {/* About Section */}
        <Text style={styles.sectionHeader}>About</Text>
        <View style={styles.groupedCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Client</Text>
            <Text style={styles.infoValue}>Messages theme</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Backend</Text>
            <Text style={styles.infoValue}>NestJS + Prisma</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>API architecture</Text>
            <Text style={styles.infoValue}>REST / Basic Auth</Text>
          </View>
        </View>

        <Text style={styles.footerNote}>
          Messages are delivered through the university 5th semester backend project.
        </Text>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.groupedBackground,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
  },
  largeTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.6,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.secondaryText,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 16,
  },
  groupedCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  profileTextCol: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.3,
  },
  profileSubtext: {
    fontSize: 13,
    color: colors.secondaryText,
    marginTop: 2,
  },
  profileBio: {
    fontSize: 13,
    color: colors.secondaryText,
    marginTop: 3,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fieldLabel: {
    width: 60,
    fontSize: 16,
    color: colors.text,
    fontWeight: '400',
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionRowText: {
    fontSize: 16,
    color: colors.primary,
    letterSpacing: -0.3,
  },
  dangerRow: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerRowText: {
    fontSize: 16,
    color: colors.danger,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: colors.text,
  },
  infoValue: {
    fontSize: 15,
    color: colors.secondaryText,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 16,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  presetChip: {
    backgroundColor: colors.surfaceMuted,
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
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    gap: 8,
  },
  successBanner: {
    backgroundColor: colors.successSoft,
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
  },
  statusBannerText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  successText: {
    color: colors.success,
  },
  errorText: {
    color: colors.danger,
  },
  footerNote: {
    fontSize: 12,
    color: colors.secondaryText,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
  appearanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  appearanceLabel: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  appearanceNote: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.secondaryText,
    marginHorizontal: 16,
    marginTop: 8,
  },
});
