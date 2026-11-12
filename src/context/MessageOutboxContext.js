import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { fileApi } from '../api/fileApi';
import { messageApi } from '../api/messageApi';
import { getApiConfig } from '../api/config';
import { QUERY_KEYS } from '../api/hooks';
import { createMessageOutbox } from '../utils/messageOutbox';

const MessageOutboxContext = createContext(null);

export function MessageOutboxProvider({ children }) {
  const { user, baseUrl, username, password } = useAuth();
  const queryClient = useQueryClient();
  const store = useMemo(() => createMessageOutbox({
    senderId: user?.id || '',
    sendMessage: messageApi.sendMessage,
    uploadFile: fileApi.uploadFile,
    isCurrent: () => {
      const config = getApiConfig();
      return config.baseUrl === baseUrl && config.username === username && config.password === password;
    },
    onSent: (_message, payload) => {
      void queryClient.invalidateQueries({ queryKey: ['messages', payload.conversation_id] });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
    },
  }), [user?.id, baseUrl, username, password, queryClient]);

  useEffect(() => {
    store.setActive(true);
    return () => store.setActive(false);
  }, [store]);

  return <MessageOutboxContext.Provider value={store}>{children}</MessageOutboxContext.Provider>;
}

export function useMessageOutbox(conversationId) {
  const store = useContext(MessageOutboxContext);
  if (!store) throw new Error('useMessageOutbox must be used within MessageOutboxProvider');
  const messages = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const outgoingMessages = useMemo(
    () => messages.filter((message) => message.conversationId === conversationId),
    [messages, conversationId]
  );
  return { ...store, outgoingMessages, isSending: store.isSending(conversationId) };
}
