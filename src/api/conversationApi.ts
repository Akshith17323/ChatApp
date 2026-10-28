import { apiFetch } from './config';
import { Conversation, CreateConversationPayload } from './types';

export const conversationApi = {
  /**
   * Fetch all conversations the authenticated user is a participant in,
   * sorted newest first.
   * GET /conversation
   */
  async getConversations(): Promise<Conversation[]> {
    return apiFetch<Conversation[]>('/conversation');
  },

  /**
   * Create a new conversation (DM or GROUP) or retrieve existing DM.
   * Caller is automatically added as participant and creator.
   * POST /conversation
   */
  async createConversation(payload: CreateConversationPayload): Promise<Conversation> {
    return apiFetch<Conversation>('/conversation', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Helper to start or open a direct message with a user.
   */
  async startDirectMessage(recipientId: string): Promise<Conversation> {
    return conversationApi.createConversation({
      type: 'DM',
      recipient_id: recipientId,
    });
  },

  /**
   * Helper to create a group conversation.
   */
  async createGroup(name: string, participantIds: string[]): Promise<Conversation> {
    return conversationApi.createConversation({
      type: 'GROUP',
      name,
      participants_ids: participantIds,
    });
  },
};
