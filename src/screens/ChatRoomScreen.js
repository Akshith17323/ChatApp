import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Image,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { useAppTheme, useThemedStyles } from '../context/ThemeContext';
import { useSocket } from '../context/SocketContext';
import { useNotification } from '../context/NotificationContext';
import { useMessageOutbox } from '../context/MessageOutboxContext';
import { useMessages, useUsers } from '../api/hooks';
import { getAuthHeader, getApiConfig } from '../api';
import { messageApi } from '../api/messageApi';
import { fileApi } from '../api/fileApi';
import { mergeChatMessages } from '../utils/messageOutbox';
import { getMessageKey, updateMessageMotion } from '../utils/messageMotion';
import { motion } from '../theme/motion';
import AppleAvatar from '../components/AppleAvatar';
import AppleTypingIndicator from '../components/AppleTypingIndicator';
import AnimatedPressable from '../components/AnimatedPressable';

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageEntrance({ messageKey, animate, onEntered, style, children }) {
  const [shouldEnter] = useState(animate);
  useLayoutEffect(() => {
    onEntered(messageKey);
  }, [messageKey, onEntered]);

  return (
    <Animated.View entering={shouldEnter ? motion.enter : undefined} style={style} collapsable={false}>
      {children}
    </Animated.View>
  );
}

export default function ChatRoomScreen({ route, navigation }) {
  const { conversationId, title, type, memberCount } = route.params;
  const { user } = useAuth();
  const { colors, isDark, reduceMotion } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [inputText, setInputText] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [webImageUris, setWebImageUris] = useState({});
  const flatListRef = useRef(null);
  const inputRef = useRef('');
  const pickerActive = useRef(false);
  const isNearBottom = useRef(true);
  const shouldScrollToEnd = useRef(true);
  const lastScrolledMessageKey = useRef(null);
  const scrollMetrics = useRef({ height: 0, offset: 0 });
  const historyScrollAnchor = useRef(null);
  const typingTimeoutRef = useRef(null);

  useLayoutEffect(() => {
    isNearBottom.current = true;
    shouldScrollToEnd.current = true;
    lastScrolledMessageKey.current = null;
    scrollMetrics.current = { height: 0, offset: 0 };
    historyScrollAnchor.current = null;
  }, [conversationId]);

  const {
    socket,
    joinConversation,
    leaveConversation,
    sendTypingStart,
    sendTypingStop,
    sendMarkRead,
    typingUsers,
  } = useSocket();
  const { setActiveConversationId } = useNotification();

  useEffect(() => {
    setActiveConversationId(conversationId);
    return () => {
      setActiveConversationId(null);
    };
  }, [conversationId, setActiveConversationId]);

  const setComposerText = useCallback((text) => {
    inputRef.current = text;
    setInputText(text);
  }, []);

  const handleInputChange = useCallback((text) => {
    setComposerText(text);
    if (text.trim().length > 0) {
      sendTypingStart(conversationId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStop(conversationId);
      }, 1500);
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      sendTypingStop(conversationId);
    }
  }, [setComposerText, sendTypingStart, sendTypingStop, conversationId]);

  // Join/leave WebSocket room
  useEffect(() => {
    joinConversation(conversationId);
    return () => {
      leaveConversation(conversationId);
    };
  }, [conversationId, joinConversation, leaveConversation]);

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const authHeader = getAuthHeader();
  const { baseUrl } = getApiConfig();

  const getMessageImageUri = (item) => {
    if (item.file?.kind === 'FILE' || item.type === 'FILE') return null;
    if (item.file?.mimeType && !item.file.mimeType.startsWith('image/')) return null;
    if (item.localImageUri) return item.localImageUri;
    if (item.imageInfo) {
      return item.imageInfo;
    }
    if (Platform.OS === 'web' && item.fileId && webImageUris[item.fileId]) {
      return webImageUris[item.fileId];
    }
    if (item.fileId) {
      return `${baseUrl}/file/${item.fileId}/download`;
    }
    if (item.file?.downloadUrl) {
      return `${baseUrl}${item.file.downloadUrl}`;
    }
    return null;
  };

  const {
    data: messagesResponse,
    isLoading,
    refetch,
    error,
  } = useMessages(conversationId);

  // Real-time message push & deletion listener
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (payload) => {
      if (payload?.conversationId === conversationId && payload?.message) {
        refetch();
        if (payload.message.id) {
          sendMarkRead(conversationId, payload.message.id);
        }
      }
    };

    const handleDeletedMessage = (payload) => {
      if (payload?.conversationId === conversationId) {
        refetch();
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:deleted', handleDeletedMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:deleted', handleDeletedMessage);
    };
  }, [socket, conversationId, refetch, sendMarkRead]);

  const [prevConversationId, setPrevConversationId] = useState(conversationId);
  const [olderMessages, setOlderMessages] = useState([]);
  const [olderCursor, setOlderCursor] = useState(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasNoMoreOlder, setHasNoMoreOlder] = useState(false);

  // Adjust state during render if conversationId changes
  if (prevConversationId !== conversationId) {
    setPrevConversationId(conversationId);
    setOlderMessages([]);
    setOlderCursor(null);
    setIsLoadingOlder(false);
    setHasNoMoreOlder(false);
  }

  const loadEarlierMessages = useCallback(async () => {
    const cursorToFetch = olderCursor || messagesResponse?.nextCursor;
    if (!cursorToFetch || isLoadingOlder || hasNoMoreOlder) return;

    setIsLoadingOlder(true);
    try {
      const resp = await messageApi.getMessages({
        conversation_id: conversationId,
        from_message_cursor: cursorToFetch,
      });
      if (resp?.data?.length) {
        isNearBottom.current = false;
        shouldScrollToEnd.current = false;
        if (Platform.OS === 'web') {
          historyScrollAnchor.current = { ...scrollMetrics.current, target: scrollMetrics.current.offset };
        }
        setOlderMessages((prev) => [...resp.data, ...prev]);
      }
      if (resp?.nextCursor) {
        setOlderCursor(resp.nextCursor);
      } else {
        setHasNoMoreOlder(true);
      }
    } catch (err) {
      showMessageAlert('Failed to load older messages', err?.message || 'Network error');
    } finally {
      setIsLoadingOlder(false);
    }
  }, [olderCursor, messagesResponse?.nextCursor, isLoadingOlder, hasNoMoreOlder, conversationId]);

  const { outgoingMessages, isSending, enqueue, retry, discard, acknowledge } =
    useMessageOutbox(conversationId);
  const isUploadingImage = outgoingMessages.some((message) => message.localStatus === 'uploading');
  const isSendBusy = isSending || isPickingImage;
  const { data: users } = useUsers();

  const allServerMessages = useMemo(() => {
    const rawList = [...olderMessages, ...(messagesResponse?.data || [])];
    const map = new Map();
    for (const m of rawList) {
      map.set(m.id, m);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [olderMessages, messagesResponse?.data]);

  const messages = useMemo(
    () => mergeChatMessages(allServerMessages, outgoingMessages),
    [allServerMessages, outgoingMessages]
  );

  useLayoutEffect(() => {
    historyScrollAnchor.current = null;
  }, [messagesResponse?.data, outgoingMessages]);

  const hasHistory = !!messagesResponse?.data;
  const [messageMotion, setMessageMotion] = useState(() => ({
    conversationId,
    messages,
    outgoingMessages,
    olderMessages,
    hasHistory,
    state: updateMessageMotion(null, messages, outgoingMessages, olderMessages, hasHistory),
  }));
  if (messageMotion.conversationId !== conversationId || messageMotion.messages !== messages ||
      messageMotion.outgoingMessages !== outgoingMessages || messageMotion.olderMessages !== olderMessages ||
      messageMotion.hasHistory !== hasHistory) {
    setMessageMotion({
      conversationId,
      messages,
      outgoingMessages,
      olderMessages,
      hasHistory,
      state: updateMessageMotion(messageMotion.conversationId === conversationId ? messageMotion.state : null,
        messages, outgoingMessages, olderMessages, hasHistory),
    });
  }
  const localMessageKeys = messageMotion.state.localKeys;
  const markMessageEntered = useCallback((key) => {
    setMessageMotion((current) => {
      if (current.conversationId !== conversationId || !current.state.enteringKeys.has(key)) return current;
      const enteringKeys = new Set(current.state.enteringKeys);
      enteringKeys.delete(key);
      return { ...current, state: { ...current.state, enteringKeys } };
    });
  }, [conversationId]);

  // On web, resolve protected attachments through authenticated API base64
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const fileIdsToFetch = messages
      .filter(
        (m) =>
          m.fileId &&
          !m.imageInfo &&
          !m.localImageUri &&
          (m.file?.kind === 'IMAGE' ||
            (!m.file?.kind && (!m.file?.mimeType || m.file?.mimeType.startsWith('image/')))) &&
          !webImageUris[m.fileId]
      )
      .map((m) => m.fileId);

    if (fileIdsToFetch.length === 0) return;

    let cancelled = false;
    for (const fileId of fileIdsToFetch) {
      fileApi
        .getFile(fileId)
        .then((file) => {
          if (!cancelled && file?.data) {
            const mime = file.mimeType || 'image/jpeg';
            const uri = file.data.startsWith('data:')
              ? file.data
              : `data:${mime};base64,${file.data}`;
            setWebImageUris((prev) => ({ ...prev, [fileId]: uri }));
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [messages, webImageUris]);

  useEffect(() => {
    if (messagesResponse?.data) acknowledge(messagesResponse.data);
  }, [messagesResponse?.data, outgoingMessages, acknowledge]);

  const userMap = React.useMemo(() => {
    const map = new Map();
    if (users) {
      for (const u of users) {
        map.set(u.id, u.name);
      }
    }
    return map;
  }, [users]);

  // Track keyboard show/hide to adapt bottom padding cleanly
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        if (Platform.OS === 'ios' && !reduceMotion) Keyboard.scheduleLayoutAnimation(event);
        setIsKeyboardVisible(true);
        if (isNearBottom.current) {
          shouldScrollToEnd.current = true;
          flatListRef.current?.getScrollResponder()?.scrollToEnd({ animated: !reduceMotion });
        }
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (event) => {
        if (Platform.OS === 'ios' && !reduceMotion) Keyboard.scheduleLayoutAnimation(event);
        setIsKeyboardVisible(false);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [reduceMotion]);

  // Configure Apple-style navigation header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <AppleAvatar
            name={title || 'Chat'}
            size={34}
            isGroup={type === 'GROUP'}
            memberCount={memberCount}
          />
          <View style={styles.headerNameRow}>
            <Text style={styles.headerNameText} numberOfLines={1}>
              {title || 'Chat'}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={10}
              color={colors.secondaryText}
              style={styles.headerChevron}
            />
          </View>
        </View>
      ),
      headerBackTitle: 'Messages',
      headerTintColor: colors.primary,
      headerStyle: {
        backgroundColor: colors.surface,
      },
      headerShadowVisible: true,
      headerRight: () => (
        <AnimatedPressable
          onPress={() => refetch()}
          style={styles.headerRefreshBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Refresh messages"
        >
          <Ionicons name="refresh-outline" size={24} color={colors.primary} />
        </AnimatedPressable>
      ),
    });
  }, [navigation, title, type, memberCount, refetch, colors, styles]);

  const handleSend = () => {
    const content = inputRef.current.trim();
    if (!content || isSendBusy || pickerActive.current) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTypingStop(conversationId);
    shouldScrollToEnd.current = true;
    // Clear only after the outbox has retained a retryable copy of the message.
    if (enqueue({ conversation_id: conversationId, content })) {
      setComposerText('');
    }
  };

  const handleDeleteMessage = (item) => {
    confirmMessageAction(
      'Delete Message',
      'Are you sure you want to delete this message? This action cannot be undone.',
      'Delete',
      async () => {
        try {
          await messageApi.deleteMessage(item.id);
          refetch();
        } catch (err) {
          showMessageAlert('Could Not Delete Message', err?.message || 'Failed to delete message.');
        }
      }
    );
  };

  const handleRetry = (message) => {
    if (isSendBusy) return;
    const retryMessage = () => {
      shouldScrollToEnd.current = true;
      retry(message.clientId);
    };
    if (message.deliveryUncertain) {
      confirmMessageAction(
        'Delivery Unconfirmed',
        'The server may have received this message before the connection failed. Retrying could send it again.',
        'Retry Anyway',
        retryMessage
      );
    } else {
      retryMessage();
    }
  };

  const handleEditFailed = (message) => {
    const restore = () => {
      if (discard(message.clientId)) setComposerText(message.content || '');
    };
    const warnings = [];
    if (message.deliveryUncertain) {
      warnings.push('The server may have received this message. Sending it again could create a duplicate.');
    }
    if (inputRef.current.trim()) {
      warnings.push('Restore this failed message instead of your current draft?');
    }
    if (warnings.length > 0) {
      confirmMessageAction('Restore Failed Message?', warnings.join('\n\n'), 'Restore', restore);
    } else {
      restore();
    }
  };

  const handleAttachmentPress = () => {
    if (isSendBusy || pickerActive.current) return;

    // Web pickers must open directly from a user interaction; native Alert is a no-op on web.
    if (Platform.OS === 'web') {
      void handlePickMedia('library');
      return;
    }

    Alert.alert(
      'Send Image',
      'Select a photo source:',
      [
        {
          text: 'Camera',
          onPress: () => handlePickMedia('camera'),
        },
        {
          text: 'Photo Library',
          onPress: () => handlePickMedia('library'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handlePickMedia = async (source) => {
    if (isSendBusy || pickerActive.current) return;
    pickerActive.current = true;
    setIsPickingImage(true);
    const draft = inputRef.current;
    try {
      let result;

      if (source === 'camera') {
        const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPerm.granted) {
          showMessageAlert(
            'Camera Access Needed',
            'Please allow camera access in your settings to take and send photos.'
          );
          return;
        }

        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.9,
          base64: true,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          quality: 0.9,
          base64: true,
        });
      }

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        showMessageAlert('Error', 'Unable to retrieve image data.');
        return;
      }

      const mimeType = asset.mimeType || 'image/jpeg';
      const fileName = asset.fileName || `photo_${Date.now()}.jpg`;
      const base64Data = `data:${mimeType};base64,${asset.base64}`;

      shouldScrollToEnd.current = true;
      const clientId = enqueue(
        {
          conversation_id: conversationId,
          content: draft.trim() || undefined,
        },
        {
          localImageUri: asset.uri,
          attachment: {
            file_name: fileName,
            mime_type: mimeType,
            data: base64Data,
          },
        }
      );
      if (clientId && inputRef.current === draft) setComposerText('');
    } catch (err) {
      showMessageAlert('Photo Unavailable', err?.message || 'Failed to select an image. Your draft has been kept.');
    } finally {
      pickerActive.current = false;
      setIsPickingImage(false);
    }
  };

  const formatMessageTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const renderMessageItem = ({ item, index }) => {
    const messageKey = getMessageKey(item, localMessageKeys);
    const isMine = item.senderId === user?.id;
    const isLastMessage = index === messages.length - 1;
    const senderName = isMine
      ? 'You'
      : userMap.get(item.senderId) || `User (${item.senderId.slice(-4)})`;

    const imageUri = getMessageImageUri(item);
    const hasImage = !!imageUri;
    const isFile = !hasImage && !!(item.fileId || item.file);
    const hasText = !!(item.content && item.content.trim().length > 0);
    const timeStr = formatMessageTime(item.createdAt);
    const isPending = item.localStatus === 'sending' || item.localStatus === 'uploading';
    const isFailed = item.localStatus === 'failed';

    let appleStatus = isMine && !isPending && !isFailed ? 'Sent' : null;
    if (appleStatus && item.status) {
      const otherStatuses = Object.entries(item.status).filter(
        ([id]) => id !== user?.id
      );
      if (otherStatuses.length > 0) {
        const anyRead = otherStatuses.some(([, s]) => s.read);
        const anyDelivered = otherStatuses.some(([, s]) => s.delivered);
        if (anyRead) appleStatus = 'Read';
        else if (anyDelivered) appleStatus = 'Delivered';
        else appleStatus = 'Sent';
      }
    }

    return (
      <MessageEntrance
        messageKey={messageKey}
        animate={!reduceMotion && messageMotion.state.enteringKeys.has(messageKey)}
        onEntered={markMessageEntered}
        style={styles.messageWrapper}
      >
        {!isMine && type === 'GROUP' && (
          <Text style={styles.groupSenderLabel}>{senderName}</Text>
        )}

        <View
          style={[
            styles.bubbleRow,
            isMine ? styles.myBubbleRow : styles.otherBubbleRow,
          ]}
        >
          <View
            style={[
              styles.bubble,
              isMine ? styles.myBubble : styles.otherBubble,
              hasImage && styles.imageBubble,
              isFailed && styles.failedBubble,
            ]}
          >
            {hasImage && (
              <AnimatedPressable
                activeOpacity={0.88}
                onPress={() => setPreviewImage(imageUri)}
                accessibilityLabel={`View photo from ${senderName}`}
              >
                <Image
                  source={{
                    uri: imageUri,
                    headers:
                      authHeader && imageUri.startsWith(`${baseUrl}/`)
                        ? { Authorization: authHeader }
                        : undefined,
                  }}
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              </AnimatedPressable>
            )}

            {isFile && (
              <View style={styles.fileAttachmentRow}>
                <Ionicons
                  name="document-text"
                  size={24}
                  color={isMine ? colors.onPrimary : colors.primary}
                  style={styles.fileIcon}
                />
                <View style={styles.fileDetails}>
                  <Text
                    style={[
                      styles.fileNameText,
                      isMine ? styles.myBubbleText : styles.otherBubbleText,
                    ]}
                    numberOfLines={1}
                  >
                    {item.file?.name || 'Attached file'}
                  </Text>
                  {item.file?.size ? (
                    <Text
                      style={[
                        styles.fileSizeText,
                        isMine ? styles.fileSizeMine : styles.fileSizeOther,
                      ]}
                    >
                      {formatFileSize(item.file.size)}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            {hasText && (
              <Text
                style={[
                  styles.bubbleText,
                  isMine ? styles.myBubbleText : styles.otherBubbleText,
                  hasImage && styles.captionText,
                ]}
              >
                {item.content}
              </Text>
            )}

            <View style={styles.bubbleFooterRow}>
              {timeStr ? (
                <Text
                  style={[
                    styles.bubbleTimeText,
                    isMine ? styles.myBubbleTimeText : styles.otherBubbleTimeText,
                  ]}
                >
                  {timeStr}
                </Text>
              ) : null}
              {isMine && !isPending && !isFailed && (
                <Ionicons
                  name={appleStatus === 'Read' ? 'checkmark-done' : 'checkmark'}
                  size={12}
                  color={colors.onPrimaryMuted}
                  style={styles.checkIcon}
                />
              )}
              {isMine && !isPending && !isFailed && !!item.id && (
                <AnimatedPressable
                  onPress={() => handleDeleteMessage(item)}
                  style={styles.deleteIconBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Delete message"
                >
                  <Ionicons
                    name="trash-outline"
                    size={11}
                    color={colors.onPrimaryMuted}
                  />
                </AnimatedPressable>
              )}
            </View>
          </View>
        </View>

        {isPending && (
          <Animated.View entering={motion.fade} exiting={motion.exit} style={styles.localStatusRow} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.localStatusText}>
              {item.localStatus === 'uploading' ? 'Uploading photo…' : 'Sending…'}
            </Text>
          </Animated.View>
        )}

        {isFailed && (
          <Animated.View entering={motion.enter} exiting={motion.exit} style={styles.failedMessageInfo} accessibilityLiveRegion="polite">
            <Text style={styles.failedMessageTitle}>
              {item.deliveryUncertain ? 'Delivery unconfirmed' : 'Not sent'}
            </Text>
            <Text style={styles.failedMessageError} numberOfLines={3}>{item.error}</Text>
            <View style={styles.failedMessageActions}>
              <AnimatedPressable
                style={[styles.messageAction, isSendBusy && styles.sendButtonDisabled]}
                onPress={() => handleRetry(item)}
                disabled={isSendBusy}
                accessibilityRole="button"
                accessibilityLabel="Retry sending this message"
                accessibilityState={{ disabled: isSendBusy }}
              >
                <Ionicons name="refresh" size={15} color={colors.primary} />
                <Text style={styles.messageActionText}>Retry</Text>
              </AnimatedPressable>
              {!hasImage && hasText && (
                <AnimatedPressable
                  style={styles.messageAction}
                  onPress={() => handleEditFailed(item)}
                  accessibilityRole="button"
                  accessibilityLabel="Restore failed message to the composer"
                >
                  <Ionicons name="pencil" size={15} color={colors.primary} />
                  <Text style={styles.messageActionText}>Edit</Text>
                </AnimatedPressable>
              )}
            </View>
          </Animated.View>
        )}

        {isMine && isLastMessage && appleStatus && (
          <Animated.Text key={appleStatus} entering={motion.fade} style={styles.appleStatusText}>{appleStatus}</Animated.Text>
        )}
      </MessageEntrance>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
        style={styles.container}
      >
        {/* Messages List Area */}
        {isLoading && messages.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : error && messages.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
            <Text style={styles.errorTitle}>Could not load messages</Text>
            <Text style={styles.errorMessage}>{error.message}</Text>
            <AnimatedPressable style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <FlatList
            key={conversationId}
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => getMessageKey(item, localMessageKeys)}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesList}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            maxToRenderPerBatch={15}
            windowSize={11}
            removeClippedSubviews={Platform.OS === 'android'}
            maintainVisibleContentPosition={Platform.OS === 'web' ? undefined : { minIndexForVisible: 1 }}
            ListHeaderComponent={
              <View>
                {!hasNoMoreOlder && (olderCursor || messagesResponse?.nextCursor) ? (
                  <View style={styles.loadOlderContainer}>
                    {isLoadingOlder ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <AnimatedPressable
                        onPress={loadEarlierMessages}
                        style={styles.loadOlderButton}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel="Load earlier messages"
                      >
                        <Text style={styles.loadOlderText}>Load earlier messages</Text>
                      </AnimatedPressable>
                    )}
                  </View>
                ) : null}
                <View style={styles.dateStampContainer}>
                  <Text style={styles.dateStampText}>Messages</Text>
                </View>
                {error && (
                  <Animated.View entering={motion.fade} style={styles.refreshErrorBanner}>
                    <Text style={styles.refreshErrorText}>
                      Could not refresh messages. Your messages are still shown below.
                    </Text>
                    <AnimatedPressable
                      onPress={() => refetch()}
                      style={styles.messageAction}
                      accessibilityRole="button"
                      accessibilityLabel="Try refreshing messages again"
                    >
                      <Text style={styles.messageActionText}>Try Again</Text>
                    </AnimatedPressable>
                  </Animated.View>
                )}
                {isLoading && <ActivityIndicator size="small" color={colors.primary} />}
              </View>
            }
            ListEmptyComponent={() => (
              <View style={styles.emptyChatContainer}>
                <AppleAvatar
                  name={title || 'Chat'}
                  size={64}
                  isGroup={type === 'GROUP'}
                  memberCount={memberCount}
                />
                <Text style={styles.emptyChatTitle}>{title || 'Conversation'}</Text>
                <Text style={styles.emptyChatSubtitle}>
                  {type === 'GROUP'
                    ? `Group conversation with ${memberCount || 'several'} members.`
                    : 'Direct conversation. Say hello.'}
                </Text>
              </View>
            )}
            onScroll={({ nativeEvent }) => {
              const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
              scrollMetrics.current.offset = contentOffset.y;
              // A content resize is not the user scrolling away from the bottom.
              if (Math.abs(contentSize.height - scrollMetrics.current.height) < 1) {
                isNearBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
                if (historyScrollAnchor.current && Math.abs(contentOffset.y - historyScrollAnchor.current.target) > 1) {
                  historyScrollAnchor.current = null;
                }
              }
            }}
            onScrollBeginDrag={() => {
              isNearBottom.current = false;
              shouldScrollToEnd.current = false;
              historyScrollAnchor.current = null;
            }}
            scrollEventThrottle={16}
            onLayout={() => {
              if (isNearBottom.current || shouldScrollToEnd.current) {
                flatListRef.current?.getScrollResponder()?.scrollToEnd({ animated: false });
              }
            }}
            onContentSizeChange={(_width, height) => {
              scrollMetrics.current.height = height;
              if (historyScrollAnchor.current) {
                const anchor = historyScrollAnchor.current;
                // Virtualized rows are measured in batches, not in one content resize.
                anchor.target = Math.max(0, anchor.offset + height - anchor.height);
                flatListRef.current?.scrollToOffset({
                  offset: anchor.target,
                  animated: false,
                });
                return;
              }
              if (isNearBottom.current || shouldScrollToEnd.current) {
                const latestKey = messages.length ? getMessageKey(messages[messages.length - 1], localMessageKeys) : null;
                // Use actual content height, not FlatList's estimates for variable-height bubbles.
                flatListRef.current?.getScrollResponder()?.scrollToEnd({
                  animated: !reduceMotion && !!lastScrolledMessageKey.current && latestKey !== lastScrolledMessageKey.current,
                });
                lastScrolledMessageKey.current = latestKey;
                shouldScrollToEnd.current = false;
              }
            }}
          />
        )}

        {/* Real-time typing indicator */}
        {typingUsers[conversationId] && typingUsers[conversationId]?.userId !== user?.id && (
          <Animated.View entering={motion.fade} exiting={motion.exit}>
            <AppleTypingIndicator
              userName={typingUsers[conversationId]?.userName}
              colors={colors}
              isDark={isDark}
            />
          </Animated.View>
        )}

        {/* Apple Messages Bottom Input Bar */}
        <View
          style={[
            styles.inputContainer,
            {
              paddingBottom: isKeyboardVisible
                ? (Platform.OS === 'ios' ? 8 : 6)
                : Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 8),
            },
          ]}
        >
          {/* Circular + button for images */}
          <AnimatedPressable
            style={styles.plusButton}
            activeOpacity={0.6}
            onPress={handleAttachmentPress}
            disabled={isSendBusy}
            accessibilityRole="button"
            accessibilityLabel="Attach a photo"
            accessibilityState={{ disabled: isSendBusy }}
          >
            {isUploadingImage || isPickingImage ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="add" size={20} color={colors.text} />
            )}
          </AnimatedPressable>

          {/* Capsule Text Input */}
          <Animated.View layout={motion.layout} style={styles.textInputPill}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={handleInputChange}
              placeholder="Message"
              placeholderTextColor={colors.placeholder}
              accessibilityLabel="Message"
              multiline
              maxLength={1000}
            />

            {/* Apple upward arrow Send Button */}
            <AnimatedPressable
              style={[
                styles.sendButton,
                (!inputText.trim() || isSendBusy) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isSendBusy}
              activeOpacity={0.7}
              accessibilityLabel="Send message"
              accessibilityState={{ busy: isSendBusy }}
              hitSlop={8}
            >
              <Animated.View key={isSendBusy ? 'busy' : inputText.trim() ? 'ready' : 'empty'} entering={motion.pop}>
                {isSendBusy ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Ionicons name="arrow-up" size={17} color={colors.onPrimary} />
                )}
              </Animated.View>
            </AnimatedPressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      {/* Fullscreen Image Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent={true}
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.modalSafeArea}>
            <AnimatedPressable
              style={styles.modalCloseBtn}
              onPress={() => setPreviewImage(null)}
              activeOpacity={0.7}
              accessibilityLabel="Close photo preview"
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </AnimatedPressable>
            {previewImage && (
              <Image
                source={{
                  uri: previewImage,
                  headers:
                    authHeader && previewImage.startsWith(`${baseUrl}/`)
                      ? { Authorization: authHeader }
                      : undefined,
                }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            )}
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function confirmMessageAction(title, message, confirmText, onConfirm) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmText, onPress: onConfirm },
  ]);
}

function showMessageAlert(title, message) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
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
  headerTitleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.1,
    maxWidth: 160,
  },
  headerChevron: {
    marginLeft: 2,
  },
  headerRefreshBtn: {
    padding: 6,
    marginRight: 4,
  },
  dateStampContainer: {
    alignItems: 'center',
    marginVertical: 14,
  },
  dateStampText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.secondaryText,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  messageWrapper: {
    marginBottom: 6,
  },
  groupSenderLabel: {
    fontSize: 11,
    color: colors.secondaryText,
    marginBottom: 2,
    marginLeft: 8,
  },
  bubbleRow: {
    flexDirection: 'row',
  },
  myBubbleRow: {
    justifyContent: 'flex-end',
  },
  otherBubbleRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '74%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  myBubble: {
    backgroundColor: colors.outgoingBubble,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: colors.incomingBubble,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.3,
  },
  myBubbleText: {
    color: colors.onPrimary,
  },
  otherBubbleText: {
    color: colors.text,
  },
  appleStatusText: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: colors.secondaryText,
    marginTop: 2,
    marginRight: 4,
    letterSpacing: -0.1,
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
  errorTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginTop: 10,
  },
  errorMessage: {
    fontSize: 13,
    color: colors.secondaryText,
    textAlign: 'center',
    marginTop: 4,
  },
  retryBtn: {
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
  },
  retryBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 8,
  },
  plusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  textInputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 36,
    maxHeight: 120,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 3,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.3,
    paddingTop: Platform.OS === 'android' ? 4 : 5,
    paddingBottom: Platform.OS === 'android' ? 4 : 5,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.outgoingBubble,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    marginBottom: 1,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  imageBubble: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 6,
  },
  messageImage: {
    width: 220,
    height: 220,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  captionText: {
    marginTop: 6,
    marginHorizontal: 8,
  },
  bubbleFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
    gap: 3,
  },
  bubbleTimeText: {
    fontSize: 10,
    fontWeight: '400',
  },
  myBubbleTimeText: {
    color: colors.onPrimaryMuted,
  },
  otherBubbleTimeText: {
    color: colors.secondaryText,
  },
  checkIcon: {
    marginLeft: 1,
  },
  emptyChatContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyChatTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    letterSpacing: -0.3,
  },
  emptyChatSubtitle: {
    fontSize: 13,
    color: colors.secondaryText,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  failedBubble: {
    borderWidth: 1,
    borderColor: colors.danger,
  },
  localStatusRow: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
    marginBottom: 4,
  },
  localStatusText: {
    color: colors.secondaryText,
    fontSize: 12,
  },
  failedMessageInfo: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    marginTop: 6,
    marginBottom: 10,
  },
  failedMessageTitle: {
    color: colors.danger,
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'right',
  },
  failedMessageError: {
    color: colors.secondaryText,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'right',
    marginTop: 3,
  },
  failedMessageActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  messageAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 8,
  },
  messageActionText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  refreshErrorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    marginBottom: 14,
  },
  refreshErrorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  modalSafeArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  fullscreenImage: {
    width: '94%',
    height: '80%',
  },
  fileAttachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 8,
    maxWidth: 240,
  },
  fileIcon: {
    marginRight: 2,
  },
  fileDetails: {
    flex: 1,
  },
  fileNameText: {
    fontSize: 14,
    fontWeight: '500',
  },
  fileSizeText: {
    fontSize: 11,
    marginTop: 2,
  },
  fileSizeMine: {
    color: colors.onPrimaryMuted,
  },
  fileSizeOther: {
    color: colors.secondaryText,
  },
  loadOlderContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  loadOlderButton: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  loadOlderText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.primary,
  },
  deleteIconBtn: {
    marginLeft: 8,
    padding: 2,
  },
  typingIndicatorRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingDotBubble: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typingText: {
    fontSize: 12,
    color: colors.secondaryText,
    letterSpacing: -0.2,
  },
});
