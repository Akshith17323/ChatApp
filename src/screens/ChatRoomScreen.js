import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useMessages, useSendMessage, useUsers } from '../api/hooks';

export default function ChatRoomScreen({ route, navigation }) {
  const { conversationId, title } = route.params;
  const { user } = useAuth();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef(null);

  const {
    data: messagesResponse,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = useMessages(conversationId);

  const { mutate: sendMessage, isPending: isSending } = useSendMessage();
  const { data: users } = useUsers();

  const userMap = React.useMemo(() => {
    const map = new Map();
    if (users) {
      for (const u of users) {
        map.set(u.id, u.name);
      }
    }
    return map;
  }, [users]);

  // Set screen title dynamically
  useEffect(() => {
    navigation.setOptions({
      title: title || 'Chat',
      headerRight: () => (
        <TouchableOpacity
          onPress={() => refetch()}
          style={styles.headerRefreshBtn}
        >
          <Ionicons
            name="refresh-outline"
            size={20}
            color={isRefetching ? '#2563eb' : '#64748b'}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, title, isRefetching, refetch]);

  const handleSend = () => {
    if (!inputText.trim() || isSending) return;
    const content = inputText.trim();
    setInputText('');

    sendMessage(
      { conversation_id: conversationId, content },
      {
        onSuccess: () => {
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        },
      }
    );
  };

  const renderMessageItem = ({ item }) => {
    const isMine = item.senderId === user?.id;
    const senderName = isMine
      ? 'You'
      : userMap.get(item.senderId) || `User (${item.senderId.slice(-4)})`;

    const time = item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    // Calculate delivery / read status summary from status map
    let statusText = '';
    if (isMine && item.status) {
      const otherStatuses = Object.entries(item.status).filter(
        ([id]) => id !== user?.id
      );
      if (otherStatuses.length > 0) {
        const allRead = otherStatuses.every(([, s]) => s.read);
        const allDelivered = otherStatuses.every(([, s]) => s.delivered);
        if (allRead) statusText = '✓✓';
        else if (allDelivered) statusText = '✓';
      }
    }

    return (
      <View
        style={[
          styles.messageRow,
          isMine ? styles.myMessageRow : styles.otherMessageRow,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isMine ? styles.myBubble : styles.otherBubble,
          ]}
        >
          {!isMine && (
            <Text style={styles.senderNameLabel}>{senderName}</Text>
          )}
          <Text
            style={[
              styles.messageText,
              isMine ? styles.myMessageText : styles.otherMessageText,
            ]}
          >
            {item.content}
          </Text>
          <View style={styles.metaRow}>
            <Text
              style={[
                styles.timeText,
                isMine ? styles.myTimeText : styles.otherTimeText,
              ]}
            >
              {time}
            </Text>
            {statusText ? (
              <Text
                style={[
                  styles.statusCheck,
                  statusText === '✓✓' ? styles.readCheck : styles.deliveredCheck,
                ]}
              >
                {' '}{statusText}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  const messages = messagesResponse?.data || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={styles.container}
      >
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
            <Text style={styles.errorTitle}>Error loading messages</Text>
            <Text style={styles.errorMessage}>{error.message}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="chatbubble-ellipses-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>Say hello to start the conversation!</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Bottom Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor="#94a3b8"
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isSending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="send" size={18} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1 },
  headerRefreshBtn: { padding: 6, marginRight: 8 },
  messageList: { padding: 16, paddingBottom: 8 },
  messageRow: { marginBottom: 10, flexDirection: 'row' },
  myMessageRow: { justifyContent: 'flex-end' },
  otherMessageRow: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myBubble: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  senderNameLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8b5cf6',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#0f172a',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
  },
  myTimeText: {
    color: '#bfdbfe',
  },
  otherTimeText: {
    color: '#94a3b8',
  },
  statusCheck: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  readCheck: {
    color: '#93c5fd',
  },
  deliveredCheck: {
    color: '#e2e8f0',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { marginTop: 10, color: '#64748b' },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#b91c1c', marginTop: 10 },
  errorMessage: { fontSize: 13, color: '#ef4444', textAlign: 'center', marginTop: 4 },
  retryBtn: {
    marginTop: 12,
    backgroundColor: '#2563eb',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryBtnText: { color: '#ffffff', fontWeight: '600' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#64748b', marginTop: 10 },
  emptySubtitle: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 40,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
    color: '#0f172a',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
});
