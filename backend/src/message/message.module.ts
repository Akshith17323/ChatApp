import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { ChatGateway } from './chat.gateway';

@Module({
  controllers: [MessageController],
  providers: [MessageService, ChatGateway],
  exports: [MessageService, ChatGateway],
})
export class MessageModule {}
