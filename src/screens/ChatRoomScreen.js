import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
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
import { useAuth } from '../context/AuthContext';
import { useAppTheme, useThemedStyles } from '../context/ThemeContext';
import { useMessageOutbox } from '../context/MessageOutboxContext';
import { useMessages, useUsers } from '../api/hooks';
import { getAuthHeader, getApiConfig } from '../api';
import { mergeChatMessages } from '../utils/messageOutbox';
import AppleAvatar from '../components/AppleAvatar';

export default function ChatRoomScreen({ route, navigation }) {
  const { conversationId, title, type, memberCount } = route.params;
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const [inputText, setInputText] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const flatListRef = useRef(null);
  const inputRef = useRef('');
  const pickerActive = useRef(false);
  const isNearBottom = useRef(true);
  const shouldScrollToEnd = useRef(true);

  const setComposerText = useCallback((text) => {
    inputRef.current = text;
    setInputText(text);
  }, []);

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const authHeader = getAuthHeader();
  const { baseUrl } = getApiConfig();

  const getMessageImageUri = (item) => {
    if (item.localImageUri) return item.localImageUri;
    if (item.imageInfo) {
      return item.imageInfo;
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

  const { outgoingMessages, isSending, enqueue, retry, discard, acknowledge } =
    useMessageOutbox(conversationId);
  const isUploadingImage = outgoingMessages.some((message) => message.localStatus === 'uploading');
  const isSendBusy = isSending || isPickingImage;
  const { data: users } = useUsers();

  const messages = useMemo(
    () => mergeChatMessages(messagesResponse?.data || [], outgoingMessages),
    [messagesResponse?.data, outgoingMessages]
  );

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
      () => {
        setIsKeyboardVisible(true);
        if (isNearBottom.current) {
          shouldScrollToEnd.current = true;
          flatListRef.current?.scrollToEnd({ animated: true });
        }
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
        <TouchableOpacity
          onPress={() => refetch()}
          style={styles.headerRefreshBtn}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Refresh messages"
        >
          <Ionicons name="refresh-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, title, type, memberCount, refetch, colors, styles]);

  const handleSend = () => {
    const content = inputRef.current.trim();
    if (!content || isSendBusy || pickerActive.current) return;
    shouldScrollToEnd.current = true;
    // Clear only after the outbox has retained a retryable copy of the message.
    if (enqueue({ conversation_id: conversationId, content })) {
      setComposerText('');
    }
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
    const isMine = item.senderId === user?.id;
    const isLastMessage = index === messages.length - 1;
    const senderName = isMine
      ? 'You'
      : userMap.get(item.senderId) || `User (${item.senderId.slice(-4)})`;

    const imageUri = getMessageImageUri(item);
    const hasImage = !!imageUri;
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
      <View style={styles.messageWrapper}>
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
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => setPreviewImage(imageUri)}
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
              </TouchableOpacity>
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
            </View>
          </View>
        </View>

        {isPending && (
          <View style={styles.localStatusRow} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.localStatusText}>
              {item.localStatus === 'uploading' ? 'Uploading photo…' : 'Sending…'}
            </Text>
          </View>
        )}

        {isFailed && (
          <View style={styles.failedMessageInfo} accessibilityLiveRegion="polite">
            <Text style={styles.failedMessageTitle}>
              {item.deliveryUncertain ? 'Delivery unconfirmed' : 'Not sent'}
            </Text>
            <Text style={styles.failedMessageError} numberOfLines={3}>{item.error}</Text>
            <View style={styles.failedMessageActions}>
              <TouchableOpacity
                style={[styles.messageAction, isSendBusy && styles.sendButtonDisabled]}
                onPress={() => handleRetry(item)}
                disabled={isSendBusy}
                accessibilityRole="button"
                accessibilityLabel="Retry sending this message"
                accessibilityState={{ disabled: isSendBusy }}
              >
                <Ionicons name="refresh" size={15} color={colors.primary} />
                <Text style={styles.messageActionText}>Retry</Text>
              </TouchableOpacity>
              {!hasImage && hasText && (
                <TouchableOpacity
                  style={styles.messageAction}
                  onPress={() => handleEditFailed(item)}
                  accessibilityRole="button"
                  accessibilityLabel="Restore failed message to the composer"
                >
                  <Ionicons name="pencil" size={15} color={colors.primary} />
                  <Text style={styles.messageActionText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {isMine && isLastMessage && appleStatus && (
          <Text style={styles.appleStatusText}>{appleStatus}</Text>
        )}
      </View>
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
            <Text style={styles.loadingText}>Loading iMessages...</Text>
          </View>
        ) : error && messages.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
            <Text style={styles.errorTitle}>Could not load messages</Text>
            <Text style={styles.errorMessage}>{error.message}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.messagesList}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View>
                <View style={styles.dateStampContainer}>
                  <Text style={styles.dateStampText}>iMessage</Text>
                </View>
                {error && (
                  <View style={styles.refreshErrorBanner}>
                    <Text style={styles.refreshErrorText}>
                      Could not refresh messages. Your messages are still shown below.
                    </Text>
                    <TouchableOpacity
                      onPress={() => refetch()}
                      style={styles.messageAction}
                      accessibilityRole="button"
                      accessibilityLabel="Try refreshing messages again"
                    >
                      <Text style={styles.messageActionText}>Try Again</Text>
                    </TouchableOpacity>
                  </View>
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
                    : 'Direct conversation. Say hello! 👋'}
                </Text>
              </View>
            )}
            onScroll={({ nativeEvent }) => {
              const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
              isNearBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
            }}
            scrollEventThrottle={16}
            onContentSizeChange={() => {
              if (isNearBottom.current || shouldScrollToEnd.current) {
                flatListRef.current?.scrollToEnd({ animated: false });
                shouldScrollToEnd.current = false;
              }
            }}
          />
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
          <TouchableOpacity
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
          </TouchableOpacity>

          {/* Capsule Text Input */}
          <View style={styles.textInputPill}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setComposerText}
              placeholder="iMessage"
              placeholderTextColor={colors.placeholder}
              accessibilityLabel="Message"
              multiline
              maxLength={1000}
            />

            {/* Apple upward arrow Send Button */}
            {inputText.trim().length > 0 ? (
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  isSendBusy && styles.sendButtonDisabled,
                ]}
                onPress={handleSend}
                disabled={isSendBusy}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityState={{ disabled: isSendBusy }}
              >
                {isSendBusy ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Ionicons name="arrow-up" size={17} color={colors.onPrimary} />
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.audioWaveBtn} activeOpacity={0.6}>
                <Ionicons name="mic" size={19} color={colors.secondaryText} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Fullscreen Image Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.modalSafeArea}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setPreviewImage(null)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
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
  audioWaveBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    marginBottom: 1,
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
    gap: 5,
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
});
