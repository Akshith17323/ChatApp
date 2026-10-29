import React, { useState, useMemo } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useUsers, useCreateConversation } from '../api/hooks';
import AppleAvatar from '../components/AppleAvatar';

export default function NewChatScreen({ navigation }) {
  const { user } = useAuth();
  const { data: users, isLoading, error, refetch } = useUsers();
  const { mutate: createConversation, isPending: isCreating } = useCreateConversation();

  const [mode, setMode] = useState('DM'); // 'DM' | 'GROUP'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [groupName, setGroupName] = useState('');

  // Exclude current user from the selectable list
  const availableUsers = useMemo(() => {
    return (users || []).filter((u) => u.id !== user?.id);
  }, [users, user?.id]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return availableUsers;
    const query = searchQuery.toLowerCase();
    return availableUsers.filter((u) =>
      u.name.toLowerCase().includes(query)
    );
  }, [availableUsers, searchQuery]);

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
            memberCount: 2,
          });
        },
        onError: (err) => {
          Alert.alert('Unable to Message', err.message || 'Could not start conversation.');
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

  const handleRemoveChip = (userId) => {
    setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
  };

  const handleCreateGroup = () => {
    if (selectedUserIds.length === 0) {
      Alert.alert('Add Recipients', 'Please select at least one person for the group.');
      return;
    }
    if (!groupName.trim()) {
      Alert.alert('Group Name', 'Please enter a name for this group chat.');
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
            title: conv.name || 'Group',
            type: 'GROUP',
            memberCount: selectedUserIds.length + 1,
          });
        },
        onError: (err) => {
          Alert.alert('Unable to Create Group', err.message || 'Could not create group.');
        },
      }
    );
  };

  const renderUserItem = ({ item }) => {
    const isSelected = selectedUserIds.includes(item.id);

    return (
      <TouchableOpacity
        style={styles.userRow}
        activeOpacity={0.7}
        onPress={() => {
          if (mode === 'DM') {
            handleStartDM(item);
          } else {
            handleToggleUserSelection(item.id);
          }
        }}
      >
        <AppleAvatar name={item.name} size={44} />

        <View style={styles.userInfoCol}>
          <Text style={styles.userName}>{item.name}</Text>
          {item.bio ? <Text style={styles.userBio}>{item.bio}</Text> : null}
          <View style={styles.separator} />
        </View>

        <View style={styles.actionCol}>
          {mode === 'DM' ? (
            <Ionicons name="chatbubble" size={18} color="#007AFF" />
          ) : (
            <View
              style={[
                styles.checkboxCircle,
                isSelected && styles.checkboxCircleSelected,
              ]}
            >
              {isSelected && (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Apple Segmented Control */}
        <View style={styles.segmentContainer}>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segmentTab,
                mode === 'DM' && styles.segmentTabActive,
              ]}
              onPress={() => setMode('DM')}
            >
              <Text
                style={[
                  styles.segmentText,
                  mode === 'DM' && styles.segmentTextActive,
                ]}
              >
                Direct Message
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentTab,
                mode === 'GROUP' && styles.segmentTabActive,
              ]}
              onPress={() => setMode('GROUP')}
            >
              <Text
                style={[
                  styles.segmentText,
                  mode === 'GROUP' && styles.segmentTextActive,
                ]}
              >
                Group Chat
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Group Name input if GROUP mode */}
        {mode === 'GROUP' && (
          <View style={styles.groupHeaderBar}>
            <TextInput
              style={styles.groupNameInput}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Group Name (e.g. Project Team)"
              placeholderTextColor="#8E8E93"
            />
            <TouchableOpacity
              style={[
                styles.createGroupAppleBtn,
                (selectedUserIds.length === 0 || !groupName.trim() || isCreating) &&
                  styles.createGroupAppleBtnDisabled,
              ]}
              onPress={handleCreateGroup}
              disabled={selectedUserIds.length === 0 || !groupName.trim() || isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.createGroupAppleBtnText}>
                  Create ({selectedUserIds.length})
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Apple "To:" Header Line */}
        <View style={styles.toBarContainer}>
          <Text style={styles.toLabel}>To:</Text>

          {/* Selected chips in group mode */}
          {mode === 'GROUP' && selectedUserIds.length > 0 && (
            <View style={styles.chipsRow}>
              {selectedUserIds.map((id) => {
                const u = availableUsers.find((userItem) => userItem.id === id);
                return (
                  <TouchableOpacity
                    key={id}
                    style={styles.contactChip}
                    onPress={() => handleRemoveChip(id)}
                  >
                    <Text style={styles.contactChipText}>{u?.name || 'User'}</Text>
                    <Ionicons name="close-circle" size={14} color="#007AFF" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TextInput
            style={styles.toTextInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={selectedUserIds.length === 0 ? 'Search name' : ''}
            placeholderTextColor="#8E8E93"
            autoCapitalize="none"
          />
        </View>

        {/* User list */}
        {isLoading || isCreating ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.loadingText}>
              {isCreating ? 'Creating iMessage...' : 'Loading contacts...'}
            </Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={38} color="#FF3B30" />
            <Text style={styles.errorText}>{error.message}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No registered contacts found.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            renderItem={renderUserItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#E3E3E8',
    borderRadius: 9,
    padding: 2,
    height: 32,
  },
  segmentTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 7,
  },
  segmentTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000000',
    letterSpacing: -0.2,
  },
  segmentTextActive: {
    fontWeight: '600',
    color: '#000000',
  },
  groupHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
    gap: 8,
  },
  groupNameInput: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 15,
    color: '#000000',
  },
  createGroupAppleBtn: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  createGroupAppleBtnDisabled: {
    backgroundColor: '#E5E5EA',
  },
  createGroupAppleBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  toBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
    flexWrap: 'wrap',
    gap: 6,
  },
  toLabel: {
    fontSize: 16,
    color: '#8E8E93',
    marginRight: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5F1FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  contactChipText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  toTextInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    minWidth: 100,
    paddingVertical: 0,
  },
  listContent: {
    paddingVertical: 4,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 10,
  },
  userInfoCol: {
    flex: 1,
    marginLeft: 12,
    position: 'relative',
    paddingBottom: 10,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.3,
  },
  userBio: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  separator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: -16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5EA',
  },
  actionCol: {
    paddingLeft: 8,
    paddingBottom: 8,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#C6C6C8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCircleSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#8E8E93',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
  },
  retryBtnText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 15,
    color: '#8E8E93',
  },
});
