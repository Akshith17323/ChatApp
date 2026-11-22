import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { connectSocket, disconnectSocket, getSocket } from '../api/socket';

const SocketContext = createContext({
  socket: null,
  isConnected: false,
  onlineUserIds: new Set(),
  typingUsers: {},
  joinConversation: (_conversationId) => {},
  leaveConversation: (_conversationId) => {},
  sendTypingStart: (_conversationId) => {},
  sendTypingStop: (_conversationId) => {},
  sendMarkRead: (_conversationId, _messageId) => {},
});

export function SocketProvider({ children }) {
  const { username, password, baseUrl, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});
  const [prevAuth, setPrevAuth] = useState(isAuthenticated);
  const typingTimersRef = useRef(new Map());

  // Reset state during render if unauthenticated
  if (prevAuth !== isAuthenticated) {
    setPrevAuth(isAuthenticated);
    if (!isAuthenticated) {
      setIsConnected(false);
      setOnlineUserIds(new Set());
      setTypingUsers({});
    }
  }

  useEffect(() => {
    const timers = typingTimersRef.current;
    if (!isAuthenticated || !username || !password) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket(baseUrl, { username, password });

    const handleConnect = () => {
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleInitialConnected = (data) => {
      if (Array.isArray(data?.onlineUserIds)) {
        setOnlineUserIds(new Set(data.onlineUserIds));
      }
    };

    const handlePresenceUpdate = (data) => {
      if (!data?.userId) return;
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (data.isOnline) {
          next.add(data.userId);
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    };

    const handleTypingUpdate = (data) => {
      if (!data?.conversationId || !data?.userId) return;
      const { conversationId, userId, userName, isTyping } = data;

      // Clear any auto-expiry timer
      const existingTimer = typingTimersRef.current.get(conversationId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        typingTimersRef.current.delete(conversationId);
      }

      setTypingUsers((prev) => {
        if (!isTyping) {
          const next = { ...prev };
          delete next[conversationId];
          return next;
        }

        // Auto-clear typing indicator after 4 seconds of silence
        const timer = setTimeout(() => {
          setTypingUsers((current) => {
            const copy = { ...current };
            delete copy[conversationId];
            return copy;
          });
        }, 4000);
        typingTimersRef.current.set(conversationId, timer);

        return {
          ...prev,
          [conversationId]: { userId, userName },
        };
      });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connected', handleInitialConnected);
    socket.on('presence:update', handlePresenceUpdate);
    socket.on('typing:update', handleTypingUpdate);

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connected', handleInitialConnected);
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('typing:update', handleTypingUpdate);
      disconnectSocket();
      setIsConnected(false);
    };
  }, [isAuthenticated, username, password, baseUrl]);

  const joinConversation = useCallback((conversationId) => {
    const socket = getSocket();
    if (socket && conversationId) {
      socket.emit('room:join', { conversationId });
    }
  }, []);

  const leaveConversation = useCallback((conversationId) => {
    const socket = getSocket();
    if (socket && conversationId) {
      socket.emit('room:leave', { conversationId });
    }
  }, []);

  const sendTypingStart = useCallback((conversationId) => {
    const socket = getSocket();
    if (socket && conversationId) {
      socket.emit('typing:start', { conversationId });
    }
  }, []);

  const sendTypingStop = useCallback((conversationId) => {
    const socket = getSocket();
    if (socket && conversationId) {
      socket.emit('typing:stop', { conversationId });
    }
  }, []);

  const sendMarkRead = useCallback((conversationId, messageId) => {
    const socket = getSocket();
    if (socket && conversationId && messageId) {
      socket.emit('message:read', { conversationId, messageId });
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: getSocket(),
        isConnected,
        onlineUserIds,
        typingUsers,
        joinConversation,
        leaveConversation,
        sendTypingStart,
        sendTypingStop,
        sendMarkRead,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
