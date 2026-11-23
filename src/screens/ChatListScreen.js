import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, useThemedStyles } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { useConversations, useUsers } from '../api/hooks';
import AppleAvatar from '../components/AppleAvatar';
import AnimatedPressable from '../components/AnimatedPressable';
import { motion } from '../theme/motion';

export default function ChatListScreen({ navigation }) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const { user } = useAuth();
  const { onlineUserIds, socket } = useSocket();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const {
    data: conversations,
    isLoading,
    refetch,
    error,
  } = useConversations();

  const { data: users } = useUsers();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Listen for real-time conversation updates over WebSocket
  useEffect(() => {
    if (!socket) return;
    const handleConversationUpdated = () => {
      refetch();
    };
    socket.on('conversation:updated', handleConversationUpdated);
    return () => {
      socket.off('conversation:updated', handleConversationUpdated);
    };
  }, [socket, refetch]);

  // Create an id -> name lookup map
  const userMap = useMemo(() => {
    const map = new Map();
    if (users) {
      for (const u of users) {
        map.set(u.id, u.name);
      }
    }
    return map;
  }, [users]);

  const getConversationTitle = useCallback((item) => {
    if (item.type === 'DM') {
      const otherId = item.participants_ids?.find((id) => id !== user?.id);
      if (otherId && userMap.has(otherId)) {
        return userMap.get(otherId);
      }
      if (otherId) return `User (${otherId.slice(-4)})`;
    }

    if (item.name) return item.name;

    return item.type === 'DM' ? 'Direct Message' : 'Group Conversation';
  }, [userMap, user?.id]);

  const formatAppleDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) return 'Yesterday';

    const diffDays = Math.round((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }

    return date.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: '2-digit' });
  };

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    if (!searchQuery.trim()) return conversations;
    const query = searchQuery.toLowerCase();
    return conversations.filter((item) => {
      const title = getConversationTitle(item).toLowerCase();
      return title.includes(query);
    });
  }, [conversations, searchQuery, getConversationTitle]);

  const renderConversationItem = ({ item }) => {
    const title = getConversationTitle(item);
    const isDm = item.type === 'DM';
    const dateStr = formatAppleDate(item.createdAt);
    const memberCount = item.participants_ids?.length || 0;
    const otherId = isDm ? item.participants_ids?.find((id) => id !== user?.id) : null;
    const isOnline = isDm && otherId ? onlineUserIds.has(otherId) : false;

    return (
      <AnimatedPressable
        style={styles.chatRow}
        activeOpacity={0.7}
        pressScale={0.99}
        accessibilityLabel={`Open conversation with ${title}`}
        onPress={() =>
          navigation.navigate('ChatRoom', {
            conversationId: item.id,
            title,
            type: item.type,
            memberCount,
          })
        }
      >
        {/* Apple Avatar */}
        <AppleAvatar
          name={title}
          size={48}
          isGroup={!isDm}
          memberCount={memberCount}
          isOnline={isOnline}
        />

        {/* Content & Apple styled right edge */}
        <View style={styles.chatContentContainer}>
          <View style={styles.chatHeaderRow}>
            <Text style={styles.chatTitle} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.timeChevronRow}>
              <Text style={styles.chatTime}>{dateStr}</Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={colors.secondaryText}
                style={styles.chevron}
              />
            </View>
          </View>

          <Text style={styles.chatSubtitle} numberOfLines={2}>
            {isDm ? (isOnline ? 'Online' : 'Offline') : `${memberCount} members`}
          </Text>

          {/* Inset Hairline Separator */}
          <View style={styles.separator} />
        </View>
      </AnimatedPressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View entering={motion.fade} style={styles.container}>
        {/* Top iOS Navigation Bar */}
        <View style={styles.topNav}>
          <TouchableOpacity style={styles.editBtn}>
            <Text style={styles.navActionText}>Edit</Text>
          </TouchableOpacity>
          <AnimatedPressable
            style={styles.composeBtn}
            onPress={() => navigation.navigate('NewChat')}
            accessibilityLabel="New message"
            hitSlop={8}
          >
            <Ionicons name="create-outline" size={24} color={colors.primary} />
          </AnimatedPressable>
        </View>

        {/* Large iOS Header Title */}
        <View style={styles.largeTitleContainer}>
          <Text style={styles.largeTitle}>Messages</Text>
        </View>

        {/* Apple Capsule Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={17} color={colors.secondaryText} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search"
              placeholderTextColor={colors.placeholder}
              returnKeyType="search"
              accessibilityLabel="Search conversations"
            />
            {searchQuery.length > 0 ? (
              <AnimatedPressable
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={colors.secondaryText} />
              </AnimatedPressable>
            ) : (
              <Ionicons name="mic" size={17} color={colors.secondaryText} style={styles.micIcon} />
            )}
          </View>
        </View>

        {/* Main Content List */}
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading Messages...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle" size={48} color={colors.danger} />
            <Text style={styles.errorTitle}>Messages Unavailable</Text>
            <Text style={styles.errorMessage}>{error.message}</Text>
            <AnimatedPressable style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </AnimatedPressable>
          </View>
        ) : filteredConversations.length === 0 ? (
          <View style={styles.centerContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="chatbubble-ellipses" size={40} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{searchQuery.trim() ? 'No Results' : 'No Messages'}</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery.trim() ? 'Try a different name.' : 'Start a new conversation to say hello.'}
            </Text>
            <AnimatedPressable
              style={styles.newChatAppleBtn}
              onPress={() => navigation.navigate('NewChat')}
            >
              <Text style={styles.newChatAppleBtnText}>New Message</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <FlatList
            data={filteredConversations}
            keyExtractor={(item) => item.id}
            renderItem={renderConversationItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          />
        )}
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
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 4,
    paddingBottom: 4,
  },
  navActionText: {
    fontSize: 17,
    color: colors.primary,
    letterSpacing: -0.4,
  },
  editBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  composeBtn: {
    padding: 4,
  },
  largeTitleContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  largeTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.6,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.input,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.3,
    paddingVertical: 0,
  },
  micIcon: {
    marginLeft: 6,
  },
  listContent: {
    paddingBottom: 24,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  chatContentContainer: {
    flex: 1,
    marginLeft: 12,
    position: 'relative',
    paddingBottom: 11,
    justifyContent: 'center',
  },
  chatHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.2,
    flex: 1,
    marginRight: 8,
  },
  timeChevronRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatTime: {
    fontSize: 14,
    color: colors.secondaryText,
    letterSpacing: -0.2,
  },
  chevron: {
    marginLeft: 4,
  },
  chatSubtitle: {
    fontSize: 14,
    color: colors.secondaryText,
    lineHeight: 18,
    letterSpacing: -0.2,
    marginTop: 1,
    marginRight: 8,
  },
  separator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 15,
    color: colors.secondaryText,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: colors.secondaryText,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  retryBtn: {
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
  },
  retryBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.secondaryText,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  newChatAppleBtn: {
    backgroundColor: colors.outgoingBubble,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 22,
  },
  newChatAppleBtnText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
