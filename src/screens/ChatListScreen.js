import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useConversations, useUsers } from '../api/hooks';

export default function ChatListScreen({ navigation }) {
  const { user, logout } = useAuth();
  const {
    data: conversations,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useConversations();

  const { data: users } = useUsers();

  // Create an id -> name lookup map
  const userMap = React.useMemo(() => {
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
      const otherId = item.participants_ids.find((id) => id !== user?.id);
      if (otherId && userMap.has(otherId)) {
        return userMap.get(otherId);
      }
      return otherId ? `User (${otherId.slice(-4)})` : 'Direct Message';
    }

    return 'Group Conversation';
  };

  const renderConversationItem = ({ item }) => {
    const title = getConversationTitle(item);
    const isDm = item.type === 'DM';
    const dateStr = item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() =>
          navigation.navigate('ChatRoom', {
            conversationId: item.id,
            title,
            type: item.type,
          })
        }
      >
        <View style={[styles.avatar, isDm ? styles.dmAvatar : styles.groupAvatar]}>
          <Ionicons
            name={isDm ? 'person' : 'people'}
            size={22}
            color="#ffffff"
          />
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatHeaderRow}>
            <Text style={styles.chatTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.chatTime}>{dateStr}</Text>
          </View>
          <Text style={styles.chatSubtitle} numberOfLines={1}>
            {isDm ? 'Direct Message' : `${item.participants_ids?.length || 0} members`}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* User Header bar */}
      <View style={styles.userBar}>
        <View>
          <Text style={styles.welcomeText}>Logged in as</Text>
          <Text style={styles.currentUserName}>{user?.name || 'User'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Conversations List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Could not load conversations</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : conversations && conversations.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the button below to start chatting with registered users or FactBots!
          </Text>
          <TouchableOpacity
            style={styles.startChatButton}
            onPress={() => navigation.navigate('NewChat')}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.startChatText}>Start a Chat</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversationItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
        />
      )}

      {/* Floating Action Button for New Chat */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewChat')}
      >
        <Ionicons name="create-outline" size={26} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  userBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  welcomeText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  currentUserName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
  },
  logoutText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 8,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  dmAvatar: {
    backgroundColor: '#3b82f6',
  },
  groupAvatar: {
    backgroundColor: '#8b5cf6',
  },
  chatInfo: {
    flex: 1,
  },
  chatHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
    marginRight: 8,
  },
  chatTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  chatSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#b91c1c',
    marginTop: 12,
  },
  errorMessage: {
    fontSize: 13,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 4,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  startChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 6,
  },
  startChatText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});
