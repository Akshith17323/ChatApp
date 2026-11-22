import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export interface SocketAuth {
  username?: string;
  password?: string;
}

/**
 * Initializes and connects the singleton Socket.io client.
 */
export function connectSocket(baseUrl: string, auth: SocketAuth): Socket {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  const cleanUrl = baseUrl.replace(/\/+$/, '');
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
}
