import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, useThemedStyles } from '../context/ThemeContext';
import { useUsers, useCreateConversation } from '../api/hooks';
import AppleAvatar from '../components/AppleAvatar';
import AnimatedPressable from '../components/AnimatedPressable';
import { motion } from '../theme/motion';

function showScreenAlert(title, message) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export default function NewChatScreen({ navigation }) {
  const { colors, reduceMotion } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const { data: users, isLoading, error, refetch } = useUsers();
  const { mutate: createConversation, isPending: isCreating } = useCreateConversation();

  const [mode, setMode] = useState('DM'); // 'DM' | 'GROUP'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [segmentWidth, setSegmentWidth] = useState(0);
  const segmentPosition = useSharedValue(0);
  const segmentStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: segmentPosition.get() * segmentWidth }],
  }));

  useEffect(() => {
    const target = mode === 'GROUP' ? 1 : 0;
    segmentPosition.set(reduceMotion ? target : withSpring(target, motion.spring));
  }, [mode, reduceMotion, segmentPosition]);

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
        participants_ids: [targetUser.id],
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
          showScreenAlert('Unable to Message', err.message || 'Could not start conversation.');
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
      showScreenAlert('Add Recipients', 'Please select at least one person for the group.');
      return;
    }
    if (!groupName.trim()) {
      showScreenAlert('Group Name', 'Please enter a name for this group chat.');
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
          showScreenAlert('Unable to Create Group', err.message || 'Could not create group.');
        },
      }
    );
  };

  const renderUserItem = ({ item }) => {
    const isSelected = selectedUserIds.includes(item.id);

    return (
      <AnimatedPressable
        style={styles.userRow}
        activeOpacity={0.7}
        pressScale={0.99}
        disabled={isCreating}
        accessibilityRole={mode === 'GROUP' ? 'checkbox' : 'button'}
        accessibilityLabel={mode === 'GROUP' ? item.name : `Message ${item.name}`}
        accessibilityState={{ checked: mode === 'GROUP' ? isSelected : undefined }}
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
            <Ionicons name="chatbubble" size={18} color={colors.primary} />
          ) : (
            <View
              style={[
                styles.checkboxCircle,
                isSelected && styles.checkboxCircleSelected,
              ]}
            >
              {isSelected && (
                <Animated.View entering={motion.pop}>
                  <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                </Animated.View>
              )}
            </View>
          )}
        </View>
      </AnimatedPressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View entering={motion.fade} style={styles.container}>
        {/* Apple Segmented Control */}
        <View style={styles.segmentContainer}>
          <View
            style={styles.segmentedControl}
            onLayout={(event) => setSegmentWidth(Math.max(0, (event.nativeEvent.layout.width - 4) / 2))}
            accessibilityRole="radiogroup"
          >
            <Animated.View pointerEvents="none" style={[styles.segmentIndicator, segmentStyle]} />
            <AnimatedPressable
              style={styles.segmentTab}
              onPress={() => setMode('DM')}
              disabled={isCreating}
              pressScale={1}
              accessibilityRole="radio"
              accessibilityState={{ checked: mode === 'DM' }}
            >
              <Text
                style={[
                  styles.segmentText,
                  mode === 'DM' && styles.segmentTextActive,
                ]}
              >
                Direct Message
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              style={styles.segmentTab}
              onPress={() => setMode('GROUP')}
              disabled={isCreating}
              pressScale={1}
              accessibilityRole="radio"
              accessibilityState={{ checked: mode === 'GROUP' }}
            >
              <Text
                style={[
                  styles.segmentText,
                  mode === 'GROUP' && styles.segmentTextActive,
                ]}
              >
                Group Chat
              </Text>
            </AnimatedPressable>
          </View>
        </View>

        {/* Group Name input if GROUP mode */}
        {mode === 'GROUP' && (
          <Animated.View entering={motion.enter} exiting={motion.exit} style={styles.groupHeaderBar}>
            <TextInput
              style={styles.groupNameInput}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Group Name (e.g. Project Team)"
              placeholderTextColor={colors.placeholder}
              accessibilityLabel="Group name"
            />
            <AnimatedPressable
              style={[
                styles.createGroupAppleBtn,
                (selectedUserIds.length === 0 || !groupName.trim() || isCreating) &&
                  styles.createGroupAppleBtnDisabled,
              ]}
              onPress={handleCreateGroup}
              disabled={selectedUserIds.length === 0 || !groupName.trim() || isCreating}
              accessibilityState={{ busy: isCreating }}
            >
              {isCreating ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text style={styles.createGroupAppleBtnText}>
                  Create ({selectedUserIds.length})
                </Text>
              )}
            </AnimatedPressable>
          </Animated.View>
        )}

        {/* Apple "To:" Header Line */}
        <Animated.View layout={motion.layout} style={styles.toBarContainer}>
          <Text style={styles.toLabel}>To:</Text>

          {/* Selected chips in group mode */}
          {mode === 'GROUP' && selectedUserIds.length > 0 && (
            <Animated.View layout={motion.layout} style={styles.chipsRow}>
              {selectedUserIds.map((id) => {
                const u = availableUsers.find((userItem) => userItem.id === id);
                return (
                  <Animated.View
                    key={id}
                    entering={motion.pop}
                    exiting={motion.exit}
                    layout={motion.layout}
                  >
                    <AnimatedPressable
                      style={styles.contactChip}
                      onPress={() => handleRemoveChip(id)}
                      accessibilityLabel={`Remove ${u?.name || 'recipient'}`}
                      hitSlop={6}
                    >
                      <Text style={styles.contactChipText}>{u?.name || 'User'}</Text>
                      <Ionicons name="close-circle" size={14} color={colors.primary} />
                    </AnimatedPressable>
                  </Animated.View>
                );
              })}
            </Animated.View>
          )}

          <TextInput
            style={styles.toTextInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={selectedUserIds.length === 0 ? 'Search name' : ''}
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            accessibilityLabel="Search contacts"
          />
        </Animated.View>

        {/* User list */}
        <Animated.View layout={motion.layout} style={styles.listContainer}>
          {isLoading || isCreating ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>
                {isCreating ? 'Starting conversation…' : 'Loading contacts…'}
              </Text>
            </View>
          ) : error ? (
            <View style={styles.centerContainer}>
              <Ionicons name="alert-circle-outline" size={38} color={colors.danger} />
              <Text style={styles.errorText}>{error.message}</Text>
              <AnimatedPressable style={styles.retryBtn} onPress={() => refetch()}>
                <Text style={styles.retryBtnText}>Try Again</Text>
              </AnimatedPressable>
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
              keyboardShouldPersistTaps="handled"
            />
          )}
        </Animated.View>
      </Animated.View>
    </SafeAreaView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: colors.input,
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
  segmentIndicator: {
    position: 'absolute',
    left: 2,
    top: 2,
    bottom: 2,
    borderRadius: 7,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    letterSpacing: -0.2,
  },
  segmentTextActive: {
    fontWeight: '600',
    color: colors.text,
  },
  groupHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 8,
  },
  groupNameInput: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 15,
    color: colors.text,
  },
  createGroupAppleBtn: {
    backgroundColor: colors.outgoingBubble,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  createGroupAppleBtnDisabled: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.55,
  },
  createGroupAppleBtnText: {
    color: colors.onPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  toBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexWrap: 'wrap',
    gap: 6,
  },
  toLabel: {
    fontSize: 16,
    color: colors.secondaryText,
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
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  contactChipText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  toTextInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    minWidth: 100,
    paddingVertical: 0,
  },
  listContent: {
    paddingVertical: 4,
  },
  listContainer: {
    flex: 1,
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
    color: colors.text,
    letterSpacing: -0.3,
  },
  userBio: {
    fontSize: 13,
    color: colors.secondaryText,
    marginTop: 2,
  },
  separator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: -16,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
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
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCircleSelected: {
    backgroundColor: colors.outgoingBubble,
    borderColor: colors.outgoingBubble,
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
    color: colors.secondaryText,
  },
  errorText: {
    fontSize: 14,
    color: colors.danger,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
  },
  retryBtnText: {
    color: colors.primary,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 15,
    color: colors.secondaryText,
  },
});
