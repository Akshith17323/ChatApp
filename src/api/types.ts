/**
 * TypeScript definitions matching the Chat App NestJS backend API.
 * Docs: http://10.7.1.51:3000/docs#/
 */

export interface User {
  id: string;
  name: string;
  bio?: string;
}

export type ConversationType = 'DM' | 'GROUP';

export interface Conversation {
  id: string;
  name?: string | null;
  type: ConversationType;
  createdAt: string;
  createdBy: string;
  participants_ids: string[];
}

export interface FileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'IMAGE' | 'FILE';
  uploadedBy: string;
  createdAt: string;
  downloadUrl: string;
  sourceUrl?: string | null;
}

export interface FileDetail extends FileMetadata {
  data: string; // base64
}

export interface MessageStatus {
  delivered: boolean;
  read: boolean;
}

export interface Message {
  id: string;
  content?: string | null;
  imageInfo?: string | null;
  type?: 'TEXT' | 'IMAGE' | 'FILE';
  fileId?: string | null;
  file?: FileMetadata | null;
  createdAt: string;
  senderId: string;
  conversationId: string;
  status: Record<string, MessageStatus>;
}

export interface PaginatedMessagesResponse {
  data: Message[];
  nextCursor?: string | null;
  count: number;
}

export interface CreateConversationPayload {
  type?: ConversationType;
  name?: string;
  recipient_id?: string;
  participants_ids?: string[];
}

export interface CreateMessagePayload {
  conversation_id: string;
  content?: string;
  imageInfo?: string;
  file_id?: string;
}

export interface UploadFilePayload {
  file_name?: string;
  mime_type?: string;
  data?: string;
  url?: string;
}

export interface GetMessagesParams {
  conversation_id: string;
  from_message_cursor?: string;
}

export interface ApiConfig {
  baseUrl: string;
  username?: string;
  password?: string;
}
