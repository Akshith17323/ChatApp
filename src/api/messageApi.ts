import { apiFetch } from './config';
import {
  CreateMessagePayload,
  GetMessagesParams,
  Message,
  PaginatedMessagesResponse,
} from './types';

export const messageApi = {
  /**
   * Fetch messages for a conversation with cursor pagination.
   * First page: omit `from_message_cursor`.
   * Subsequent pages: pass `nextCursor` from the previous response.
   * Returns data in chronological (oldest-first) order.
   * GET /message?conversation_id=...&from_message_cursor=...
   */
  async getMessages(params: GetMessagesParams): Promise<PaginatedMessagesResponse> {
    const searchParams = new URLSearchParams();
    searchParams.append('conversation_id', params.conversation_id);
    if (params.from_message_cursor) {
      searchParams.append('from_message_cursor', params.from_message_cursor);
    }

    return apiFetch<PaginatedMessagesResponse>(`/message?${searchParams.toString()}`);
  },

  /**
   * Send a new message to a conversation.
   * POST /message
   */
  async sendMessage(payload: CreateMessagePayload): Promise<Message> {
    return apiFetch<Message>('/message', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
