import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
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
import { useMessages, useSendMessage, useUsers } from '../api/hooks';
import { fileApi, getAuthHeader, getApiConfig } from '../api';
import AppleAvatar from '../components/AppleAvatar';

export default function ChatRoomScreen({ route, navigation }) {
  const { conversationId, title, type, memberCount } = route.params;
  const { user } = useAuth();
  const [inputText, setInputText] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const flatListRef = useRef(null);

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const authHeader = getAuthHeader();
  const { baseUrl } = getApiConfig();

  const getMessageImageUri = (item) => {
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

  // Track keyboard show/hide to adapt bottom padding cleanly
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
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
              color="#8E8E93"
              style={styles.headerChevron}
            />
          </View>
        </View>
      ),
      headerBackTitle: 'Messages',
      headerTintColor: '#007AFF',
      headerStyle: {
        backgroundColor: '#FFFFFF',
      },
      headerShadowVisible: true,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => refetch()}
          style={styles.headerRefreshBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="videocam-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, title, type, memberCount, refetch]);

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

  const handleAttachmentPress = () => {
    if (isUploadingImage || isSending) return;

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
    try {
      let result;

      if (source === 'camera') {
        const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!cameraPerm.granted) {
          Alert.alert(
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
        const libraryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libraryPerm.granted) {
          Alert.alert(
            'Photo Access Needed',
            'Please allow photo library access in your settings to select and send images.'
          );
          return;
        }

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
        Alert.alert('Error', 'Unable to retrieve image data.');
        return;
      }

      setIsUploadingImage(true);

      const mimeType = asset.mimeType || 'image/jpeg';
      const fileName = asset.fileName || `photo_${Date.now()}.jpg`;
      const base64Data = `data:${mimeType};base64,${asset.base64}`;

      // 1. Upload file to backend
      const uploadedFile = await fileApi.uploadFile({
        file_name: fileName,
        mime_type: mimeType,
        data: base64Data,
      });

      // 2. Send message with file_id and optional caption from inputText
      const caption = inputText.trim();
      if (caption) {
        setInputText('');
      }

      sendMessage(
        {
          conversation_id: conversationId,
          file_id: uploadedFile.id,
          content: caption || undefined,
        },
        {
          onSuccess: () => {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          },
          onError: (err) => {
            Alert.alert('Send Failed', err?.message || 'Could not send image message');
          },
          onSettled: () => {
            setIsUploadingImage(false);
          },
        }
      );
    } catch (err) {
      setIsUploadingImage(false);
      Alert.alert('Upload Failed', err?.message || 'Failed to select or upload image.');
    }
  };

  const messages = messagesResponse?.data || [];

  const renderMessageItem = ({ item, index }) => {
    const isMine = item.senderId === user?.id;
    const isLastMessage = index === messages.length - 1;
    const senderName = isMine
      ? 'You'
      : userMap.get(item.senderId) || `User (${item.senderId.slice(-4)})`;

    const imageUri = getMessageImageUri(item);
    const hasImage = !!imageUri;
    const hasText = !!(item.content && item.content.trim().length > 0);

    let appleStatus = null;
    if (isMine && item.status) {
      const otherStatuses = Object.entries(item.status).filter(
        ([id]) => id !== user?.id
      );
      if (otherStatuses.length > 0) {
        const anyRead = otherStatuses.some(([, s]) => s.read);
        const anyDelivered = otherStatuses.some(([, s]) => s.delivered);
        if (anyRead) appleStatus = 'Read';
        else if (anyDelivered) appleStatus = 'Delivered';
        else appleStatus = 'Sent';
      } else {
        appleStatus = 'Delivered';
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
                      authHeader && !imageUri.startsWith('data:')
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
          </View>
        </View>

        {isMine && isLastMessage && appleStatus && (
          <Text style={styles.appleStatusText}>{appleStatus}</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={headerHeight}
        style={styles.container}
      >
        {/* Messages List Area */}
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.loadingText}>Loading iMessages...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={40} color="#FF3B30" />
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
            ListHeaderComponent={() => (
              <View style={styles.dateStampContainer}>
                <Text style={styles.dateStampText}>iMessage</Text>
              </View>
            )}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
          />
        )}

        {/* Apple Messages Bottom Input Bar */}
        <View
          style={[
            styles.inputContainer,
            {
              paddingBottom: isKeyboardVisible
                ? 8
                : Math.max(insets.bottom, 8),
            },
          ]}
        >
          {/* Circular + button for images */}
          <TouchableOpacity
            style={styles.plusButton}
            activeOpacity={0.6}
            onPress={handleAttachmentPress}
            disabled={isUploadingImage || isSending}
          >
            {isUploadingImage ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Ionicons name="add" size={20} color="#3C3C43" />
            )}
          </TouchableOpacity>

          {/* Capsule Text Input */}
          <View style={styles.textInputPill}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="iMessage"
              placeholderTextColor="#8E8E93"
              multiline
              maxLength={1000}
            />

            {/* Apple upward arrow Send Button */}
            {inputText.trim().length > 0 ? (
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  isSending && styles.sendButtonDisabled,
                ]}
                onPress={handleSend}
                disabled={isSending}
                activeOpacity={0.7}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="arrow-up" size={17} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.audioWaveBtn} activeOpacity={0.6}>
                <Ionicons name="mic" size={19} color="#8E8E93" />
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
                    authHeader && !previewImage.startsWith('data:')
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    color: '#000000',
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
    color: '#8E8E93',
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
    color: '#8E8E93',
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
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#E9E9EB',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.3,
  },
  myBubbleText: {
    color: '#FFFFFF',
  },
  otherBubbleText: {
    color: '#000000',
  },
  appleStatusText: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: '#8E8E93',
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
    color: '#8E8E93',
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
    marginTop: 10,
  },
  errorMessage: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 4,
  },
  retryBtn: {
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
  },
  retryBtnText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#C6C6C8',
    gap: 8,
  },
  plusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E9E9EB',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#C6C6C8',
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 3,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    letterSpacing: -0.3,
    paddingTop: 5,
    paddingBottom: 5,
  },
  sendButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#007AFF',
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
    backgroundColor: '#E5E5EA',
  },
  captionText: {
    marginTop: 6,
    marginHorizontal: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
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
