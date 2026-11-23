import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiQuery, ApiBody } from '@nestjs/swagger';
import { UserService } from './user.service';
import { GetUserProfileDto, UpdatePushTokenDto, UserResponseDto } from './dto/user.dto';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('users')
@ApiSecurity('basic-auth')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch('push-token')
  @ApiOperation({
    summary: 'Register or update FCM device push token',
    description: 'Registers the mobile device FCM push token for push notifications when the app is in background or closed.',
  })
  @ApiBody({ type: UpdatePushTokenDto })
  @ApiResponse({ status: 200, description: 'Push token updated successfully' })
  updatePushToken(@CurrentUser() user: any, @Body() body: UpdatePushTokenDto) {
    return this.userService.updatePushToken(user.id, body.pushToken);
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Get user profile',
    description:
      'Returns the profile of the target user if user_id query parameter is provided, ' +
      'otherwise returns the authenticated caller profile. ' +
      'Conversation details are omitted for privacy.',
  })
  @ApiQuery({
    name: 'user_id',
    required: false,
    description: 'Unique identifier of the target user (defaults to authenticated caller)',
    example: '64b8f9e2c4a3b12d4e5f6789',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid Authorization header' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getProfile(@CurrentUser() user: any, @Query() query: GetUserProfileDto) {
    const targetUserId = query.user_id || user.id;
    return this.userService.getProfile(targetUserId);
  }

  @Get()
  @ApiOperation({
    summary: 'List all users',
    description:
      'Returns every registered user on the platform (id, name, bio). ' +
      'Useful for discovering users to start conversations with.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of all users',
    type: [UserResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid Authorization header' })
  getAllUsers() {
    return this.userService.getAllUsers();
  }
}
