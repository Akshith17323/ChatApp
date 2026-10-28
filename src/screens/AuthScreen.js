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
      setLocalError('Please enter both username and password.');
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Chat App</Text>
          <Text style={styles.subtitle}>NestJS + MongoDB Chat API</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In / Auto-Register</Text>
          <Text style={styles.infoText}>
            First time? Your user will be created automatically on the backend!
          </Text>

          <Text style={styles.label}>Backend Server URL</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://10.7.1.51:3000"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.presetRow}>
            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => setServerUrl('http://10.7.1.51:3000')}
            >
              <Text style={styles.presetText}>10.7.1.51:3000</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => setServerUrl('http://10.0.2.2:3000')}
            >
              <Text style={styles.presetText}>Android Emul.</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.presetButton}
              onPress={() => setServerUrl('http://localhost:3000')}
            >
              <Text style={styles.presetText}>localhost</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="e.g. John Doe"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password / Secret</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="e.g. secret123"
            secureTextEntry
          />

          {(localError || error) ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{localError || error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Connect & Enter</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.docsCard}>
          <Text style={styles.docsTitle}>API Information</Text>
          <Text style={styles.docsText}>
            • Target: {serverUrl}
          </Text>
          <Text style={styles.docsText}>
            • Auth: Basic {'<username>:<password>'}
          </Text>
          <Text style={styles.docsText}>
            • Supports DMs, Group Chats, and FactBots!
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: { flex: 1, backgroundColor: '#f8fafc' },
  container: {
    padding: 24,
    justifyContent: 'center',
    flexGrow: 1,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    marginBottom: 6,
  },
  presetButton: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  presetText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
  },
  docsCard: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  docsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1d4ed8',
    marginBottom: 4,
  },
  docsText: {
    fontSize: 13,
    color: '#1e40af',
    marginTop: 2,
  },
});
