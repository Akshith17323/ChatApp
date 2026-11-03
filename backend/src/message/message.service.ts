import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/message.dto';
import { colorizeName } from '../common/color.util';
import { FILE_META_SELECT, toFileResponse } from '../file/file.service';

const PAGE_SIZE = 20;

@Injectable()
export class MessageService {
  private readonly logger = new Logger('Chat');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch messages for a conversation using cursor-based pagination.
   * - No cursor  → 20 most-recent messages.
   * - With cursor → 20 messages older than the cursor message.
   * Returned oldest-first within the page (natural chat order).
   */
  async getMessages(conversationId: string, fromMessageCursor?: string) {
    const query: any = {
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      select: {
        id: true,
        content: true,
        imageInfo: true,
        createdAt: true,
        senderId: true,
        conversationId: true,
        status: true,
        fileId: true,
      },
    };

    if (fromMessageCursor) {
      const cursorMessage = await this.prisma.message.findUnique({
        where: { id: fromMessageCursor },
      });
      if (!cursorMessage) {
        throw new NotFoundException(`Cursor message '${fromMessageCursor}' not found`);
      }
      query.cursor = { id: fromMessageCursor };
      query.skip = 1;
    }

    const messages = await this.prisma.message.findMany(query);
    const sorted = await this.withAttachments([...messages].reverse());

    return {
      data: sorted,
      nextCursor: messages.length === PAGE_SIZE ? messages[messages.length - 1].id : null,
      count: sorted.length,
    };
  }

  /**
   * Create a new message.
   * senderId comes from the authenticated user, not the request body.
   * Builds default status JSON: sender = delivered+read, others = false.
   * Logs interactive message detail with deterministic ANSI user colors.
   */
  async createMessage(dto: CreateMessageDto, senderId: string) {
    // Must have at least content, imageInfo, or file_id
    if (!dto.content && !dto.imageInfo && !dto.file_id) {
      throw new BadRequestException('Message must contain content, imageInfo, or file_id');
    }

    // An attachment must exist and belong to the sender
    if (dto.file_id) {
      const file = await this.prisma.file.findUnique({
        where: { id: dto.file_id },
        select: { uploadedBy: true },
      });
      if (!file) {
        throw new NotFoundException(`File '${dto.file_id}' not found`);
      }
      if (file.uploadedBy !== senderId) {
        throw new ForbiddenException('You can only send files you uploaded');
      }
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversation_id },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation '${dto.conversation_id}' not found`);
    }

    // Auto-prefix raw Base64 strings missing the data URI scheme
    let normalizedImageInfo: string | null = null;
    if (dto.imageInfo) {
      normalizedImageInfo = dto.imageInfo.startsWith('data:')
        ? dto.imageInfo
        : `data:image/jpeg;base64,${dto.imageInfo}`;
    }

    // Fetch participant names explicitly — Prisma MongoDB relation joins are unreliable
    const participants = await this.prisma.user.findMany({
      where: { id: { in: conversation.participants_ids } },
      select: { id: true, name: true },
    });

    const defaultStatus: Record<string, { delivered: boolean; read: boolean }> = {};
    for (const participantId of conversation.participants_ids) {
      defaultStatus[participantId] =
        participantId === senderId
          ? { delivered: true, read: true }
          : { delivered: false, read: false };
    }

    const message = await this.prisma.message.create({
      data: {
        content: dto.content ?? null,
        imageInfo: normalizedImageInfo,
        senderId,
        conversationId: dto.conversation_id,
        status: defaultStatus,
        fileId: dto.file_id ?? null,
      },
    });
    const [response] = await this.withAttachments([message]);

    // ─── Interactive Console Logging ──────────────────────────────────────────
    const isDm = conversation.type === 'DM';

    // Fetch sender separately — sender may not appear in participants lookup if IDs mismatch
    const senderUser = participants.find((u) => u.id === senderId)
      ?? await this.prisma.user.findUnique({ where: { id: senderId }, select: { id: true, name: true } });

    const senderName = senderUser?.name ?? `id:${senderId}`;
    const resolvedSenderId = senderUser?.id ?? senderId;
    const receiverUsers = participants.filter((u) => u.id !== resolvedSenderId);

    const convLabel = isDm
      ? `DM [${participants.map((u) => colorizeName(u.name)).join(', ')}]`
      : conversation.name
        ? `Group "${conversation.name}"`
        : `Group [${participants.map((u) => colorizeName(u.name)).join(', ')}]`;

    const coloredSender = colorizeName(senderName);
    const coloredReceivers =
      receiverUsers.length > 0
        ? receiverUsers.map((u) => colorizeName(u.name)).join(', ')
        : 'None';

    // Guard: log [IMG] tag instead of raw Base64 to protect terminal
    const file = (response as any).file as ReturnType<typeof toFileResponse> | null;
    const attachmentLabel = file ? `[${file.kind} ${file.name}] ` : '';
    const imgLabel = normalizedImageInfo ? '[IMG] ' : '';
    const contentLabel = (response as any).content ? `\x1b[37m${(response as any).content}\x1b[0m` : '';

    this.logger.log(
      `\x1b[36m[MSG]\x1b[0m \x1b[1m${convLabel}\x1b[0m │ ${coloredSender} \x1b[33m➔\x1b[0m ${coloredReceivers} │ ${attachmentLabel}${imgLabel}"${contentLabel}"`,
    );

    return response;
  }

  /**
   * Adds `type` (TEXT / IMAGE / FILE) and the attachment's metadata to each message.
   * File contents are not included; clients fetch them with GET /file/{id}.
   */
  private async withAttachments<T extends { fileId?: string | null }>(messages: T[]) {
    const fileIds = [...new Set(messages.map((m) => m.fileId).filter(Boolean))] as string[];

    const files = fileIds.length
      ? await this.prisma.file.findMany({ where: { id: { in: fileIds } }, select: FILE_META_SELECT })
      : [];
    const filesById = new Map<string, ReturnType<typeof toFileResponse>>(
      files.map((file) => [file.id, toFileResponse(file as any)]),
    );

    return messages.map((message) => {
      const file = message.fileId ? filesById.get(message.fileId) ?? null : null;
      return {
        ...message,
        fileId: message.fileId ?? null,
        type: (file ? file.kind : ((message as any).imageInfo ? 'IMAGE' : 'TEXT')) as 'TEXT' | 'IMAGE' | 'FILE',
        file,
      };
    });
  }
}
