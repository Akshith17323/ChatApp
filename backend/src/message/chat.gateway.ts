import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { readBasicCredentials, verifyPassword, matchesLegacyPassword } from '../auth/auth.util';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('ChatGateway');
  // Track online users: userId -> Set of socket ids
  private readonly activeUsers = new Map<string, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    try {
      let username = client.handshake.auth?.username;
      let password = client.handshake.auth?.password;

      if (!username && client.handshake.auth?.token) {
        try {
          const creds = readBasicCredentials(client.handshake.auth.token);
          username = creds.username;
          password = creds.password;
        } catch {}
      }

      if (!username && client.handshake.headers?.authorization) {
        try {
          const creds = readBasicCredentials(client.handshake.headers.authorization);
          username = creds.username;
          password = creds.password;
        } catch {}
      }

      if (!username || !password) {
        this.logger.warn(`Unauthorized WS connection attempt from ${client.id}`);
        client.disconnect(true);
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { name: username },
        select: { id: true, name: true, passwordHash: true, phone: true },
      });

      if (!user) {
        client.disconnect(true);
        return;
      }

      let valid = false;
      if (user.passwordHash) {
        valid = await verifyPassword(password, user.passwordHash);
      } else if (user.phone) {
        valid = matchesLegacyPassword(password, user.phone);
      }

      if (!valid) {
        client.disconnect(true);
        return;
      }

      client.data.user = { id: user.id, name: user.name };

      // Add to active users
      let sockets = this.activeUsers.get(user.id);
      const isFirstConnection = !sockets || sockets.size === 0;
      if (!sockets) {
        sockets = new Set();
        this.activeUsers.set(user.id, sockets);
      }
      sockets.add(client.id);

      // Join personal room for notifications
      client.join(`user:${user.id}`);

      // Broadcast presence if user just came online
      if (isFirstConnection) {
        this.server.emit('presence:update', {
          userId: user.id,
          isOnline: true,
        });
      }

      // Send initial connection state to this client
      client.emit('connected', {
        userId: user.id,
        onlineUserIds: Array.from(this.activeUsers.keys()),
      });

      this.logger.log(`User ${user.name} (${user.id}) connected on WS socket ${client.id}`);
    } catch (err: any) {
      this.logger.error(`Error in WS handleConnection: ${err?.message || err}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data?.user;
    if (!user) return;

    const sockets = this.activeUsers.get(user.id);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.activeUsers.delete(user.id);
        this.server.emit('presence:update', {
          userId: user.id,
          isOnline: false,
        });
      }
    }
    this.logger.log(`User ${user.name} (${user.id}) disconnected WS socket ${client.id}`);
  }

  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string }
  ) {
    const user = client.data?.user;
    if (!user || !data?.conversationId) return { error: 'Invalid request' };

    // Verify user is a member of the conversation
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: data.conversationId },
      select: { participants_ids: true },
    });

    if (!conversation || !conversation.participants_ids.includes(user.id)) {
      return { error: 'Not a member of this conversation' };
    }

    client.join(`conv:${data.conversationId}`);
    return { success: true, conversationId: data.conversationId };
  }

  @SubscribeMessage('room:leave')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string }
  ) {
    if (data?.conversationId) {
      client.leave(`conv:${data.conversationId}`);
    }
    return { success: true };
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string }
  ) {
    const user = client.data?.user;
    if (!user || !data?.conversationId) return;

    client.to(`conv:${data.conversationId}`).emit('typing:update', {
      conversationId: data.conversationId,
      userId: user.id,
      userName: user.name,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string }
  ) {
    const user = client.data?.user;
    if (!user || !data?.conversationId) return;

    client.to(`conv:${data.conversationId}`).emit('typing:update', {
      conversationId: data.conversationId,
      userId: user.id,
      userName: user.name,
      isTyping: false,
    });
  }

  @SubscribeMessage('message:read')
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageId: string }
  ) {
    const user = client.data?.user;
    if (!user || !data?.conversationId || !data?.messageId) return;

    client.to(`conv:${data.conversationId}`).emit('message:read', {
      conversationId: data.conversationId,
      messageId: data.messageId,
      userId: user.id,
    });
  }

  /**
   * Broadcast newly created message to room members and participants
   */
  broadcastNewMessage(conversationId: string, message: any, participantIds: string[]) {
    if (!this.server) return;

    // Emit to active conversation room
    this.server.to(`conv:${conversationId}`).emit('message:new', {
      conversationId,
      message,
    });

    // Also emit to each participant's personal room for conversation list updates
    for (const participantId of participantIds) {
      this.server.to(`user:${participantId}`).emit('conversation:updated', {
        conversationId,
        lastMessage: message,
      });
    }
  }

  /**
   * Broadcast message deletion
   */
  broadcastDeletedMessage(conversationId: string, messageId: string) {
    if (!this.server) return;
    this.server.to(`conv:${conversationId}`).emit('message:deleted', {
      conversationId,
      messageId,
    });
  }

  getOnlineUserIds(): string[] {
    return Array.from(this.activeUsers.keys());
  }
}
