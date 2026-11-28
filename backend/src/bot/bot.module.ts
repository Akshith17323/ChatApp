import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [MessageModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
