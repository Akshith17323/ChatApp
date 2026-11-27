import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageService } from '../message/message.service';
import { ChatGateway } from '../message/chat.gateway';
import { FACTS } from './facts.data';

// ─── Single Fixed Bot User ──────────────────────────────────────────────────
const BOT_USER = { name: 'FactBot' };

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private timer: NodeJS.Timeout | null = null;
  private botUserId: string | null = null;
  private factIndex = 0;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly messageService?: MessageService,
    @Optional() private readonly chatGateway?: ChatGateway,
  ) { }

  async onModuleInit() {
    this.logger.log('Bot simulation enabled (BOT_MODE=true)');
    await this.seedBotUser();

    // Start 10-second ticker
    this.timer = setInterval(() => {
      this.sendBotMessages();
    }, 10_000);

    this.logger.log(
      `FactBot active (${BOT_USER.name}): sending facts every 10s to all real users.`,
    );
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log('Bot simulation stopped.');
    }
  }

  // ─── Seed single fixed bot user ─────────────────────────────────────────────
  private async seedBotUser() {
    let user = await this.prisma.user.findUnique({
      where: { name: BOT_USER.name },
    });
    if (!user) {
      try {
        user = await this.prisma.user.create({
          data: { name: BOT_USER.name, bio: 'I am a FactBot 🤖' },
        });
      } catch (error) {
        if (error.code !== 'P2002') throw error;
        user = await this.prisma.user.findUnique({ where: { name: BOT_USER.name } });
        if (!user) throw error;
      }
    }
    if (user.phone === 'BOT_001') {
      await this.prisma.user.update({ where: { id: user.id }, data: { phone: null } });
    }
    this.botUserId = user.id;
    if (this.botUserId) {
      this.chatGateway?.setBotOnline(this.botUserId);
    }
  }

  // ─── Core loop: every tick, EVERY real user gets a fact in the same DM ───
  private async sendBotMessages() {
    try {
      if (!this.botUserId) return;

      // Ensure bot stays marked online
      this.chatGateway?.setBotOnline(this.botUserId);

      // Get all real (non-bot) users
      const realUsers = await this.prisma.user.findMany({
        where: {
          name: { not: BOT_USER.name },
        },
      });

      if (realUsers.length === 0) {
        this.logger.debug('No real users found yet — skipping bot tick.');
        return;
      }

      this.logger.log('\x1b[35m[BOT]\x1b[0m \x1b[1m🤖 Bot is Chatting...\x1b[0m');

      for (const realUser of realUsers) {
        // Reuse existing DM with bot or create a single one
        const conversation = await this.findOrCreateDm(realUser.id);
        if (!conversation) continue;

        // 1. Emit live typing indicator before sending (1200ms preview)
        if (this.chatGateway) {
          this.chatGateway.broadcastTyping(conversation.id, this.botUserId, BOT_USER.name, true);
        }
        await new Promise((resolve) => setTimeout(resolve, 1200));

        // 2. Pick next fact (cycle)
        const fact = FACTS[this.factIndex % FACTS.length];
        this.factIndex++;

        if (this.messageService) {
          // Send via messageService to trigger real-time WebSocket broadcast and interactive logging
          await this.messageService.createMessage(
            { conversation_id: conversation.id, content: fact },
            this.botUserId,
          );
        } else {
          // Fallback if messageService is unavailable (e.g. isolated test environments)
          const status: Record<string, { delivered: boolean; read: boolean }> = {
            [this.botUserId]: { delivered: true, read: true },
            [realUser.id]: { delivered: false, read: false },
          };

          await this.prisma.message.create({
            data: {
              content: fact,
              senderId: this.botUserId,
              conversationId: conversation.id,
              status,
            },
          });
        }

        // 3. Clear typing indicator
        if (this.chatGateway) {
          this.chatGateway.broadcastTyping(conversation.id, this.botUserId, BOT_USER.name, false);
        }
      }
    } catch (err) {
      this.logger.error('Bot message tick failed:', err?.message ?? err);
    }
  }

  // ─── Find existing DM with FactBot or create a single new one ─────────────
  private async findOrCreateDm(realUserId: string) {
    if (!this.botUserId) return null;

    // Check if DM already exists between this real user and FactBot
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'DM',
        OR: [
          { participants_ids: { equals: [this.botUserId, realUserId] } },
          { participants_ids: { equals: [realUserId, this.botUserId] } },
        ],
      },
    });

    if (existing) {
      const expectedName = `[DM] ${BOT_USER.name}`;
      if (existing.name !== expectedName) {
        await this.prisma.conversation.update({
          where: { id: existing.id },
          data: { name: expectedName },
        });
        existing.name = expectedName;
      }
      return existing;
    }

    // No existing DM — create one with FactBot
    const conversation = await this.prisma.conversation.create({
      data: {
        name: `[DM] ${BOT_USER.name}`,
        type: 'DM',
        createdBy: this.botUserId,
        participants_ids: [this.botUserId, realUserId],
      },
    });

    return conversation;
  }
}
