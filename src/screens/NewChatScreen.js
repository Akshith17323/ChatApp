import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useUsers, useCreateConversation } from '../api/hooks';

export default function NewChatScreen({ navigation }) {
  const { user } = useAuth();
  const { data: users, isLoading, error, refetch } = useUsers();
  const { mutate: createConversation, isPending: isCreating } = useCreateConversation();

  const [mode, setMode] = useState('DM'); // 'DM' | 'GROUP'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [groupName, setGroupName] = useState('');

  // Exclude current user from the selectable list
  const availableUsers = (users || []).filter((u) => u.id !== user?.id);

  const filteredUsers = availableUsers.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartDM = (targetUser) => {
    if (isCreating) return;

    createConversation(
      {
        type: 'DM',
        recipient_id: targetUser.id,
      },
      {
        onSuccess: (conv) => {
          navigation.replace('ChatRoom', {
            conversationId: conv.id,
            title: targetUser.name,
            type: 'DM',
          });
        },
        onError: (err) => {
          Alert.alert('Error', err.message || 'Could not start conversation.');
        },
      }
    );
  };

  const handleToggleUserSelection = (userId) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleCreateGroup = () => {
    if (selectedUserIds.length === 0) {
      Alert.alert('Select Members', 'Please select at least one other participant.');
      return;
    }
    if (!groupName.trim()) {
      Alert.alert('Group Name', 'Please provide a name for the group.');
      return;
    }

    createConversation(
      {
        type: 'GROUP',
        name: groupName.trim(),
        participants_ids: selectedUserIds,
      },
      {
        onSuccess: (conv) => {
          navigation.replace('ChatRoom', {
            conversationId: conv.id,
            title: conv.name || 'Group Chat',
            type: 'GROUP',
          });
        },
        onError: (err) => {
          Alert.alert('Error', err.message || 'Could not create group.');
        },
      }
    );
  };

  const renderUserItem = ({ item }) => {
    const isSelected = selectedUserIds.includes(item.id);

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => {
          if (mode === 'DM') {
            handleStartDM(item);
          } else {
            handleToggleUserSelection(item.id);
          }
        }}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>
            {item.name ? item.name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          {item.bio ? <Text style={styles.userBio}>{item.bio}</Text> : null}
        </View>

        {mode === 'DM' ? (
          <Ionicons name="chatbubble-outline" size={20} color="#2563eb" />
        ) : (
          <Ionicons
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={22}
            color={isSelected ? '#2563eb' : '#94a3b8'}
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Mode toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'DM' && styles.toggleBtnActive]}
          onPress={() => setMode('DM')}
        >
          <Text style={[styles.toggleText, mode === 'DM' && styles.toggleTextActive]}>
            Direct Message
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'GROUP' && styles.toggleBtnActive]}
          onPress={() => setMode('GROUP')}
        >
          <Text style={[styles.toggleText, mode === 'GROUP' && styles.toggleTextActive]}>
            New Group
          </Text>
        </TouchableOpacity>
      </View>

      {/* Group Name input if in GROUP mode */}
      {mode === 'GROUP' && (
        <View style={styles.groupInputSection}>
          <TextInput
            style={styles.groupNameInput}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group Name (e.g. Study Group)"
            placeholderTextColor="#94a3b8"
          />
          <TouchableOpacity
            style={[
              styles.createGroupBtn,
              (selectedUserIds.length === 0 || !groupName.trim() || isCreating) &&
                styles.createGroupBtnDisabled,
            ]}
            onPress={handleCreateGroup}
            disabled={selectedUserIds.length === 0 || !groupName.trim() || isCreating}
          >
            {isCreating ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.createGroupBtnText}>
                Create ({selectedUserIds.length})
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search registered users..."
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
        />
      </View>

      {isLoading || isCreating ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>
            {isCreating ? 'Creating conversation...' : 'Finding users...'}
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#ef4444" />
          <Text style={styles.errorText}>{error.message}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="people-outline" size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>No users found.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  toggleRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: '#f1f5f9',
  },
  toggleBtnActive: {
    backgroundColor: '#2563eb',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  groupInputSection: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  groupNameInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  createGroupBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createGroupBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  createGroupBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a' },
  listContent: { paddingVertical: 12 },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4338ca',
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  userBio: { fontSize: 12, color: '#64748b', marginTop: 2 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: { marginTop: 12, color: '#64748b' },
  errorText: { color: '#ef4444', textAlign: 'center', marginTop: 8 },
  retryBtn: {
    marginTop: 12,
    backgroundColor: '#2563eb',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  retryBtnText: { color: '#ffffff', fontWeight: '600' },
  emptyText: { color: '#94a3b8', marginTop: 8 },
});
