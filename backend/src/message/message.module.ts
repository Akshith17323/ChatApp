import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { ChatGateway } from './chat.gateway';
import { FcmService } from './fcm.service';

@Module({
  controllers: [MessageController],
  providers: [MessageService, ChatGateway, FcmService],
  exports: [MessageService, ChatGateway, FcmService],
})
export class MessageModule {}
