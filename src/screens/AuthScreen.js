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
import { DEFAULT_BASE_URL } from '../api/config';

export default function AuthScreen({ navigation }) {
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
              <Ionicons name="chatbubble-ellipses" size={48} color="#FFFFFF" />
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
                placeholderTextColor="#C7C7CC"
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
                placeholderTextColor="#C7C7CC"
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
                placeholderTextColor="#C7C7CC"
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
                style={styles.presetChip}
                onPress={() => setServerUrl('http://10.7.1.51:3000')}
              >
                <Text style={styles.presetChipText}>10.7.1.51:3000</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setServerUrl('http://localhost:3000')}
              >
                <Text style={styles.presetChipText}>localhost:3000</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => setServerUrl('http://10.0.2.2:3000')}
              >
                <Text style={styles.presetChipText}>Android (10.0.2.2)</Text>
              </TouchableOpacity>
            </View>
          </View>

          {(localError || error) ? (
            <View style={styles.errorBox}>
              <Ionicons name="information-circle" size={18} color="#FF3B30" />
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
              <ActivityIndicator color="#FFFFFF" size="small" />
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7',
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
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  groupedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
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
    color: '#000000',
    fontWeight: '500',
  },
  rowInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    letterSpacing: -0.2,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C6C6C8',
  },
  presetSection: {
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  presetHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
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
    backgroundColor: '#E3E3E8',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  presetChipText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  errorBoxText: {
    flex: 1,
    fontSize: 13,
    color: '#FF3B30',
    lineHeight: 18,
  },
  continueButton: {
    backgroundColor: '#007AFF',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  appleFooterNote: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 16,
    paddingHorizontal: 20,
  },
});
