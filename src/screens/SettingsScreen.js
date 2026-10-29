import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/userApi';
import AppleAvatar from '../components/AppleAvatar';

export default function SettingsScreen() {
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
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
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
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </View>
        </View>

        {/* Server Configuration Section */}
        <Text style={styles.sectionHeader}>SERVER CONFIGURATION</Text>
        <View style={styles.groupedCard}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>URL</Text>
            <TextInput
              style={styles.fieldInput}
              value={editingUrl}
              onChangeText={setEditingUrl}
              placeholder="http://10.7.1.51:3000"
              placeholderTextColor="#8E8E93"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.rowDivider} />

          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleSaveUrl}
            activeOpacity={0.6}
          >
            <Text style={styles.actionRowText}>Apply Server URL</Text>
            <Ionicons name="cloud-upload-outline" size={19} color="#007AFF" />
          </TouchableOpacity>

          <View style={styles.rowDivider} />

          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleTestConnection}
            disabled={testingPing}
            activeOpacity={0.6}
          >
            <Text style={styles.actionRowText}>Test Connection</Text>
            {testingPing ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Ionicons name="pulse-outline" size={19} color="#007AFF" />
            )}
          </TouchableOpacity>
        </View>

        {pingResult && (
          <View
            style={[
              styles.statusBanner,
              pingResult.success ? styles.successBanner : styles.errorBanner,
            ]}
          >
            <Ionicons
              name={pingResult.success ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={pingResult.success ? '#34C759' : '#FF3B30'}
            />
            <Text
              style={[
                styles.statusBannerText,
                pingResult.success ? styles.successText : styles.errorText,
              ]}
            >
              {pingResult.message}
            </Text>
          </View>
        )}

        {/* Account Section */}
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.groupedCard}>
          <TouchableOpacity
            style={styles.dangerRow}
            onPress={logout}
            activeOpacity={0.6}
          >
            <Text style={styles.dangerRowText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <Text style={styles.sectionHeader}>ABOUT</Text>
        <View style={styles.groupedCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Client Engine</Text>
            <Text style={styles.infoValue}>Apple Messages Theme</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Backend Framework</Text>
            <Text style={styles.infoValue}>NestJS + Prisma</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>API Architecture</Text>
            <Text style={styles.infoValue}>REST / Basic Auth</Text>
          </View>
        </View>

        <Text style={styles.footerNote}>
          Messages are delivered through the university 5th semester backend project.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7',
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
    color: '#000000',
    letterSpacing: -0.6,
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    letterSpacing: 0.2,
    marginTop: 22,
    marginBottom: 6,
    marginLeft: 14,
  },
  groupedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
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
    color: '#000000',
    letterSpacing: -0.3,
  },
  profileSubtext: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  profileBio: {
    fontSize: 13,
    color: '#3C3C43',
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
    color: '#000000',
    fontWeight: '400',
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    letterSpacing: -0.2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  actionRowText: {
    fontSize: 16,
    color: '#007AFF',
    letterSpacing: -0.3,
  },
  dangerRow: {
    paddingVertical: 13,
    alignItems: 'center',
  },
  dangerRowText: {
    fontSize: 16,
    color: '#FF3B30',
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
    color: '#000000',
  },
  infoValue: {
    fontSize: 15,
    color: '#8E8E93',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C6C6C8',
    marginLeft: 16,
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
    backgroundColor: '#EAF8EE',
  },
  errorBanner: {
    backgroundColor: '#FFEBEA',
  },
  statusBannerText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  successText: {
    color: '#28A745',
  },
  errorText: {
    color: '#FF3B30',
  },
  footerNote: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
});
