import { Controller, Get, Post, Delete, Query, Body, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
  ApiParam,
  ApiSecurity,
} from '@nestjs/swagger';
import { MessageService } from './message.service';
import {
  GetMessagesDto,
  CreateMessageDto,
  MessageResponseDto,
  PaginatedMessagesResponseDto,
} from './dto/message.dto';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('messages')
@ApiSecurity('basic-auth')
@Controller('message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get()
  @ApiOperation({
    summary: 'Get paginated messages',
    description:
      'Fetches messages only for a conversation the caller participates in, using cursor-based pagination. ' +
      'First call: omit from_message_cursor. ' +
      'Subsequent calls: pass the returned nextCursor to load older messages.',
  })
  @ApiQuery({
    name: 'conversation_id',
    description: 'Unique identifier of the target conversation',
    example: '64b8f9e2c4a3b12d4e5f0001',
  })
  @ApiQuery({
    name: 'from_message_cursor',
    required: false,
    description: 'Identifier of the last fetched message. Omit for the first page.',
    example: '64b8f9e2c4a3b12d4e5f1234',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated messages',
    type: PaginatedMessagesResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid Authorization header' })
  @ApiResponse({ status: 403, description: 'Caller is not a participant' })
  @ApiResponse({ status: 404, description: 'Conversation or cursor in this conversation not found' })
  getMessages(@Query() query: GetMessagesDto, @CurrentUser() user: any) {
    return this.messageService.getMessages(
      query.conversation_id,
      user.id,
      query.from_message_cursor,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Send a message',
    description:
      'Creates a new message in the specified conversation. ' +
      'Only participants can send. The sender is identified from the Basic Authorization header — ' +
      'no sender_id needed in the body. ' +
      'Send text via `content`, an image via `imageInfo` (Base64 data URI), or both. ' +
      'At least one of `content` or `imageInfo` must be provided. ' +
      'Delivery/read status is automatically initialized for all participants.',
  })
  @ApiBody({ type: CreateMessageDto })
  @ApiResponse({
    status: 201,
    description: 'Message created',
    type: MessageResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid Authorization header' })
  @ApiResponse({ status: 403, description: 'Caller is not a participant or does not own the attachment' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  @ApiResponse({ status: 400, description: 'Validation error or missing both content and imageInfo' })
  createMessage(@Body() body: CreateMessageDto, @CurrentUser() user: any) {
    return this.messageService.createMessage(body, user.id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a message',
    description: 'Deletes a message by ID. Only the original sender can delete their message.',
  })
  @ApiParam({ name: 'id', description: 'Unique identifier of the message to delete' })
  @ApiResponse({ status: 200, description: 'Message deleted successfully' })
  @ApiResponse({ status: 401, description: 'Missing or invalid Authorization header' })
  @ApiResponse({ status: 403, description: 'Caller is not the sender of the message' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  deleteMessage(@Param('id') id: string, @CurrentUser() user: any) {
    return this.messageService.deleteMessage(id, user.id);
  }
}
