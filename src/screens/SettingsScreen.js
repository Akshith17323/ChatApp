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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { userApi } from '../api/userApi';

export default function SettingsScreen() {
  const { user, username, baseUrl, setServerUrl, logout } = useAuth();
  const [editingUrl, setEditingUrl] = useState(baseUrl);
  const [testingPing, setTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState(null);

  const handleSaveUrl = () => {
    if (!editingUrl.trim()) return;
    setServerUrl(editingUrl.trim());
    Alert.alert('Saved', `Server URL set to ${editingUrl.trim()}`);
  };

  const handleTestConnection = async () => {
    setTestingPing(true);
    setPingResult(null);
    try {
      const res = await userApi.getUserProfile();
      setPingResult({
        success: true,
        message: `Connected successfully! Authenticated as "${res.name}" (ID: ${res.id})`,
      });
    } catch (err) {
      setPingResult({
        success: false,
        message: `Connection failed: ${err.message}`,
      });
    } finally {
      setTestingPing(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenHeader}>Settings & Backend</Text>

      {/* Profile Card */}
      <View style={styles.card}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
          <View style={styles.profileDetails}>
            <Text style={styles.userName}>{user?.name || username || 'Not logged in'}</Text>
            <Text style={styles.userId}>User ID: {user?.id || '—'}</Text>
          </View>
        </View>

        {user?.bio ? (
          <View style={styles.bioContainer}>
            <Text style={styles.bioLabel}>Bio</Text>
            <Text style={styles.bioText}>{user.bio}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Backend Configuration Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Backend Server Configuration</Text>
        <Text style={styles.helperText}>
          Default is configured to http://10.7.1.51:3000 as specified in the docs.
        </Text>

        <Text style={styles.label}>Server Base URL</Text>
        <TextInput
          style={styles.input}
          value={editingUrl}
          onChangeText={setEditingUrl}
          placeholder="http://10.7.1.51:3000"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveUrl}>
            <Text style={styles.saveBtnText}>Save URL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testBtn, testingPing && styles.btnDisabled]}
            onPress={handleTestConnection}
            disabled={testingPing}
          >
            {testingPing ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.testBtnText}>Test Ping</Text>
            )}
          </TouchableOpacity>
        </View>

        {pingResult && (
          <View
            style={[
              styles.resultBanner,
              pingResult.success ? styles.successBanner : styles.errorBanner,
            ]}
          >
            <Ionicons
              name={pingResult.success ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={pingResult.success ? '#15803d' : '#b91c1c'}
            />
            <Text
              style={[
                styles.resultText,
                pingResult.success ? styles.successText : styles.errorText,
              ]}
            >
              {pingResult.message}
            </Text>
          </View>
        )}
      </View>

      {/* API Reference Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Backend API Reference</Text>
        <Text style={styles.endpoint}>• GET /user — List all users</Text>
        <Text style={styles.endpoint}>• GET /user/profile — Caller/target profile</Text>
        <Text style={styles.endpoint}>• GET /conversation — List conversations</Text>
        <Text style={styles.endpoint}>• POST /conversation — Create DM or Group</Text>
        <Text style={styles.endpoint}>• GET /message — Fetch messages (paginated)</Text>
        <Text style={styles.endpoint}>• POST /message — Send message</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, gap: 16 },
  screenHeader: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
  helperText: { fontSize: 13, color: '#64748b', marginBottom: 12 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#ffffff' },
  profileDetails: { flex: 1 },
  userName: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  userId: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  bioContainer: {
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  bioLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', marginBottom: 2 },
  bioText: { fontSize: 13, color: '#1e293b' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
  },
  logoutBtnText: { color: '#ef4444', fontWeight: '600', fontSize: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  saveBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: { color: '#0f172a', fontWeight: '600', fontSize: 14 },
  testBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  testBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  successBanner: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1 },
  errorBanner: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1 },
  resultText: { fontSize: 12, flex: 1 },
  successText: { color: '#15803d' },
  errorText: { color: '#b91c1c' },
  endpoint: { fontSize: 13, color: '#334155', marginVertical: 3, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});
