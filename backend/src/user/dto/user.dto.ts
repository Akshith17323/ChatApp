import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetUserProfileDto {
  @ApiPropertyOptional({
    description: 'Unique identifier of the user to fetch. Defaults to authenticated user if omitted.',
    example: '64b8f9e2c4a3b12d4e5f6789',
  })
  @IsOptional()
  @IsString()
  user_id?: string;
}

export class UserResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the user',
    example: '64b8f9e2c4a3b12d4e5f6789',
  })
  id: string;

  @ApiProperty({
    description: 'Display name of the user (from Basic auth username)',
    example: 'Ritesh Sharma',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Short bio or status message',
    example: 'Building cool stuff 🚀',
  })
  bio?: string;
}

export class UpdatePushTokenDto {
  @ApiProperty({
    description: 'FCM push notification token for this device',
    example: 'f_ABC123...',
  })
  @IsString()
  pushToken: string;
}
