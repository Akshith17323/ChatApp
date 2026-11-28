import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();

export function navigateToChatRoom(conversationId: string, conversationTitle?: string) {
  if (navigationRef.isReady()) {
    try {
      navigationRef.navigate('ChatTab', {
        screen: 'ChatRoom',
        params: {
          conversationId,
          conversationTitle: conversationTitle || 'Chat',
        },
      });
    } catch (err) {
      console.warn('[NavigationRef] Failed to navigate to chat room:', err);
    }
  }
}
