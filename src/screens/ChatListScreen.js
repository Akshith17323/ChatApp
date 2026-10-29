import React, { useState, useMemo } from 'react';
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
import { useAuth } from '../context/AuthContext';
import { useConversations, useUsers } from '../api/hooks';
import AppleAvatar from '../components/AppleAvatar';

export default function ChatListScreen({ navigation }) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const {
    data: conversations,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useConversations();

  const { data: users } = useUsers();

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

  const getConversationTitle = (item) => {
    if (item.name) return item.name;

    if (item.type === 'DM') {
      const otherId = item.participants_ids?.find((id) => id !== user?.id);
      if (otherId && userMap.has(otherId)) {
        return userMap.get(otherId);
      }
      return otherId ? `User (${otherId.slice(-4)})` : 'Direct Message';
    }

    return 'Group Conversation';
  };

  const formatAppleDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
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

    const diffDays = Math.round((now - date) / (1000 * 60 * 60 * 24));
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
  }, [conversations, searchQuery, userMap, user?.id]);

  const renderConversationItem = ({ item }) => {
    const title = getConversationTitle(item);
    const isDm = item.type === 'DM';
    const dateStr = formatAppleDate(item.createdAt);
    const memberCount = item.participants_ids?.length || 0;

    return (
      <TouchableOpacity
        style={styles.chatRow}
        activeOpacity={0.7}
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
                color="#C7C7CC"
                style={styles.chevron}
              />
            </View>
          </View>

          <Text style={styles.chatSubtitle} numberOfLines={2}>
            {isDm ? 'iMessage' : `${memberCount} people`}
          </Text>

          {/* Inset Hairline Separator */}
          <View style={styles.separator} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top iOS Navigation Bar */}
        <View style={styles.topNav}>
          <TouchableOpacity style={styles.editBtn}>
            <Text style={styles.navActionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.composeBtn}
            onPress={() => navigation.navigate('NewChat')}
          >
            <Ionicons name="create-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Large iOS Header Title */}
        <View style={styles.largeTitleContainer}>
          <Text style={styles.largeTitle}>Messages</Text>
        </View>

        {/* Apple Capsule Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={17} color="#8E8E93" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search"
              placeholderTextColor="#8E8E93"
              clearButtonMode="while-editing"
            />
            {searchQuery.length === 0 && (
              <Ionicons name="mic" size={17} color="#8E8E93" style={styles.micIcon} />
            )}
          </View>
        </View>

        {/* Main Content List */}
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.loadingText}>Loading Messages...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="exclamationmark.circle" size={42} color="#FF3B30" />
            <Text style={styles.errorTitle}>Messages Unavailable</Text>
            <Text style={styles.errorMessage}>{error.message}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : filteredConversations.length === 0 ? (
          <View style={styles.centerContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="chatbubble-ellipses" size={40} color="#007AFF" />
            </View>
            <Text style={styles.emptyTitle}>No Messages</Text>
            <Text style={styles.emptySubtitle}>
              Send a new iMessage to get the conversation started.
            </Text>
            <TouchableOpacity
              style={styles.newChatAppleBtn}
              onPress={() => navigation.navigate('NewChat')}
            >
              <Text style={styles.newChatAppleBtnText}>New Message</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredConversations}
            keyExtractor={(item) => item.id}
            renderItem={renderConversationItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor="#007AFF"
              />
            }
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
    color: '#007AFF',
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
    color: '#000000',
    letterSpacing: -0.6,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3E3E8',
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
    color: '#000000',
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
    backgroundColor: '#FFFFFF',
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
    color: '#000000',
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
    color: '#8E8E93',
    letterSpacing: -0.2,
  },
  chevron: {
    marginLeft: 4,
  },
  chatSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
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
    backgroundColor: '#E5E5EA',
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
    color: '#8E8E93',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginTop: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  retryBtn: {
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
  },
  retryBtnText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#E5F1FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  newChatAppleBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 22,
  },
  newChatAppleBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
