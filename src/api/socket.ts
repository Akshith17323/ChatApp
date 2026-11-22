import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;
let currentBaseUrl: string | null = null;
let currentUsername: string | null = null;

export interface SocketAuth {
  username?: string;
  password?: string;
}

/**
 * Initializes and connects the singleton Socket.io client.
 */
export function connectSocket(baseUrl: string, auth: SocketAuth): Socket {
  const cleanUrl = baseUrl.replace(/\/+$/, '');

  // Avoid connection flapping if already connected with identical host & credentials
  if (
    socketInstance &&
    socketInstance.connected &&
    currentBaseUrl === cleanUrl &&
    currentUsername === auth.username
  ) {
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  currentBaseUrl = cleanUrl;
  currentUsername = auth.username ?? null;

  socketInstance = io(cleanUrl, {
    auth: {
      username: auth.username,
      password: auth.password,
    },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  return socketInstance;
}

/**
 * Retrieves the current Socket.io instance if connected.
 */
export function getSocket(): Socket | null {
  return socketInstance;
}

/**
 * Disconnects and destroys the active Socket.io instance.
 */
export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
  currentBaseUrl = null;
  currentUsername = null;
}
