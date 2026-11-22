import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/conversation.dto';

@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all conversations the user is a participant in,
   * sorted by createdAt descending (newest first).
   */
  async getUserConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants_ids: {
          has: userId,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
        createdBy: true,
        participants_ids: true,
      },
    });
    // Preserve legacy chats and their members, but never label a multi-person chat as private.
    return conversations.map((conversation) => ({
      ...conversation,
      type: conversation.type === 'DM' && conversation.participants_ids.length !== 2 ? 'GROUP' : conversation.type,
    }));
  }

  /**
   * Creates a new conversation (DM or GROUP), or returns an existing DM.
   * The authenticated caller is automatically added as creator and participant.
   */
  async createConversation(dto: CreateConversationDto, callerId: string) {
    const participantIds = new Set<string>();
    if (dto.participants_ids) {
      for (const id of dto.participants_ids) participantIds.add(id);
    }

    // Remove caller if caller passed their own ID in participants
    participantIds.delete(callerId);

    if (participantIds.size === 0) {
      throw new BadRequestException('At least one other participant is required');
    }

    const participantsArray = Array.from(participantIds);
    const type = dto.type ?? (participantsArray.length > 1 ? 'GROUP' : 'DM');
    if (type === 'DM' && participantsArray.length !== 1) {
      throw new BadRequestException('A DM requires exactly one other participant');
    }

    // Verify all participants exist
    const foundUsers = await this.prisma.user.findMany({
      where: { id: { in: participantsArray } },
      select: { id: true, name: true },
    });

    if (foundUsers.length !== participantsArray.length) {
      throw new NotFoundException('One or more participant users not found');
    }

    // For DMs: return existing conversation if one already exists between caller and recipient
    if (type === 'DM' && participantsArray.length === 1) {
      const otherId = participantsArray[0];
      const existing = await this.prisma.conversation.findFirst({
        where: {
          type: 'DM',
          OR: [
            { participants_ids: { equals: [callerId, otherId] } },
            { participants_ids: { equals: [otherId, callerId] } },
          ],
        },
      });

      if (existing) {
        return existing;
      }
    }

    // Always include caller in participants_ids
    const allParticipantIds = [callerId, ...participantsArray];

    // For DMs, override name to [DM] {username with whom created}
    let conversationName = dto.name ?? null;
    if (type === 'DM') {
      const otherUser = foundUsers.find((u) => u.id === participantsArray[0]);
      conversationName = `[DM] ${otherUser?.name ?? participantsArray[0]}`;
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        type,
        name: conversationName,
        createdBy: callerId,
        participants_ids: allParticipantIds,
      },
    });

    // Update conversationIds for all participants
    await this.prisma.user.updateMany({
      where: { id: { in: allParticipantIds } },
      data: {
        conversationIds: {
          push: conversation.id,
        },
      },
    });

    return conversation;
  }
}
