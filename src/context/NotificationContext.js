import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import {
  configureNotificationHandler,
  setupNotificationChannels,
  requestNotificationPermissions,
  presentLocalNotification,
} from '../services/notificationService';
import { navigateToChatRoom } from '../navigation/navigationRef';

const NotificationContext = createContext({
  activeConversationId: null,
  setActiveConversationId: (_id) => {},
  inAppNotification: null,
  dismissInAppNotification: () => {},
});

export function NotificationProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const { socket } = useSocket();
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [inAppNotification, setInAppNotification] = useState(null);
  const autoDismissTimerRef = useRef(null);

  // 1. Initial setup of notification handlers and permissions
  useEffect(() => {
    configureNotificationHandler();
    void setupNotificationChannels();

    if (isAuthenticated) {
      void requestNotificationPermissions();
    }
  }, [isAuthenticated]);

  // 2. Listen to system notification taps (heads-up / tray responses)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response?.notification?.request?.content?.data;
        if (data?.conversationId) {
          navigateToChatRoom(data.conversationId, data.conversationTitle);
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const dismissInAppNotification = useCallback(() => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
    setInAppNotification(null);
  }, []);

  // 3. Listen to incoming real-time socket events for messages
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const handleIncomingNotification = (data) => {
      if (!data) return;

      const conversationId = data.conversationId;
      const lastMessage = data.lastMessage || data.message;
      if (!lastMessage || !conversationId) return;

      // Do not notify for messages sent by the logged-in user
      if (lastMessage.senderId === user?.id) return;

      // Do not notify if user is actively in this conversation room
      if (activeConversationId === conversationId) return;

      const senderName =
        data.senderName ||
        lastMessage.senderName ||
        data.conversationName ||
        'New Message';

      let bodyText = lastMessage.content || '';
      if (!bodyText) {
        if (lastMessage.file?.name) {
          bodyText = `Sent file: ${lastMessage.file.name}`;
        } else if (lastMessage.imageInfo) {
          bodyText = 'Sent a photo';
        } else {
          bodyText = 'Sent a message';
        }
      }

      const conversationTitle = data.conversationName || senderName;

      const notifPayload = {
        title: senderName,
        body: bodyText,
        conversationId,
        conversationTitle,
      };

      // 1. Trigger native device notification (heads-up banner / sound)
      void presentLocalNotification({
        title: notifPayload.title,
        body: notifPayload.body,
        data: {
          conversationId,
          conversationTitle,
        },
      });

      // 2. Display smooth in-app floating banner
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
      }
      setInAppNotification(notifPayload);

      // Auto-hide in-app banner after 4.5 seconds
      autoDismissTimerRef.current = setTimeout(() => {
        setInAppNotification(null);
        autoDismissTimerRef.current = null;
      }, 4500);
    };

    socket.on('conversation:updated', handleIncomingNotification);

    return () => {
      socket.off('conversation:updated', handleIncomingNotification);
      if (autoDismissTimerRef.current) {
        clearTimeout(autoDismissTimerRef.current);
        autoDismissTimerRef.current = null;
      }
    };
  }, [socket, isAuthenticated, user?.id, activeConversationId]);

  return (
    <NotificationContext.Provider
      value={{
        activeConversationId,
        setActiveConversationId,
        inAppNotification,
        dismissInAppNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  return useContext(NotificationContext);
}
