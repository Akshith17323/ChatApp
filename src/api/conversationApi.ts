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
   * Sanitizes payload keys to strictly match NestJS whitelisted DTO properties:
   * `recipient_id` (for DMs) and `participants_ids` (for groups).
   * POST /conversation
   */
  async createConversation(payload: CreateConversationPayload): Promise<Conversation> {
    const body: Record<string, any> = {};
    if (payload.type) body.type = payload.type;
    if (payload.name) body.name = payload.name;

    // Normalizes recipient_id (accepts aliases like participant_id)
    const recipient =
      payload.recipient_id ||
      (payload as any).participant_id ||
      (payload as any).recipientId;
    if (recipient) {
      body.recipient_id = recipient;
    }

    // Normalizes participants_ids (accepts aliases like participant_ids)
    const participants =
      payload.participants_ids ||
      (payload as any).participant_ids ||
      (payload as any).participantIds;
    if (participants && Array.isArray(participants) && participants.length > 0) {
      body.participants_ids = participants;
    }

    return apiFetch<Conversation>('/conversation', {
      method: 'POST',
      body: JSON.stringify(body),
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
