import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString, IsUrl, Matches, MaxLength, ValidateIf } from 'class-validator';

// ─── Request DTOs ─────────────────────────────────────────────────────────────

/** Send exactly one of `data` (base64) or `url` (the server downloads it). */
export class UploadFileDto {
  @ApiPropertyOptional({
    description:
      'Original file name, shown to other users and used for downloads. ' +
      'Required with `data`. With `url` it is optional: the name comes from the server\'s ' +
      'Content-Disposition header or the end of the URL.',
    example: 'holiday.jpg',
    maxLength: 255,
  })
  @ValidateIf((o) => o.url === undefined || o.file_name !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  file_name?: string;

  @ApiPropertyOptional({
    description:
      'MIME type of the file. Optional when `data` is a data URL (the type is read from it) ' +
      'or when the file is a PNG/JPEG/GIF/WebP/BMP/HEIC image (the type is detected from its bytes).',
    example: 'image/jpeg',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[\w.+-]+\/[\w.+-]+$/, { message: 'mime_type must look like type/subtype, e.g. image/png' })
  mime_type?: string;

  @ApiPropertyOptional({
    description:
      'File contents encoded as base64. Plain base64 ("iVBORw0KGgo...") or a data URL ' +
      '("data:image/png;base64,iVBORw0KGgo...") are both accepted. Leave out when sending `url`.',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  })
  @ValidateIf((o) => o.url === undefined || o.data !== undefined)
  @IsString()
  @IsNotEmpty()
  data?: string;

  @ApiPropertyOptional({
    description:
      'A public http(s) link to download the file from, instead of sending `data`. ' +
      'The server downloads it (same size limit and image checks as base64 uploads) and stores a copy, ' +
      'so the message keeps working even if the link later breaks. ' +
      'Links to private or local addresses are refused.',
    example: 'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png',
    maxLength: 2048,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true, require_valid_protocol: true },
    { message: 'url must be a full http:// or https:// link' },
  )
  url?: string;
}

export class FileIdParamDto {
  @ApiProperty({ description: 'MongoDB ObjectId of the file', example: '64b8f9e2c4a3b12d4e5f9001' })
  @IsMongoId()
  id: string;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export class FileResponseDto {
  @ApiProperty({ description: 'Unique MongoDB ObjectId of the file', example: '64b8f9e2c4a3b12d4e5f9001' })
  id: string;

  @ApiProperty({ description: 'Original file name', example: 'holiday.jpg' })
  name: string;

  @ApiProperty({ description: 'MIME type', example: 'image/jpeg' })
  mimeType: string;

  @ApiProperty({ description: 'Size in bytes (of the decoded file, not the base64 text)', example: 48213 })
  size: number;

  @ApiProperty({
    description: 'IMAGE for recognised image formats, FILE for everything else',
    enum: ['IMAGE', 'FILE'],
    example: 'IMAGE',
  })
  kind: 'IMAGE' | 'FILE';

  @ApiProperty({ description: 'MongoDB ObjectId of the user who uploaded the file', example: '64b8f9e2c4a3b12d4e5f6789' })
  uploadedBy: string;

  @ApiProperty({ description: 'ISO timestamp of the upload', example: '2024-01-15T10:34:00.000Z' })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'The link the file was downloaded from, for files uploaded with `url`; null for base64 uploads',
    example: null,
    nullable: true,
  })
  sourceUrl: string | null;

  @ApiProperty({
    description: 'Path that returns the raw bytes (send the same Authorization header)',
    example: '/file/64b8f9e2c4a3b12d4e5f9001/download',
  })
  downloadUrl: string;
}

export class FileWithDataResponseDto extends FileResponseDto {
  @ApiProperty({
    description:
      'File contents as plain base64. To show an image, use `data:${mimeType};base64,${data}` as its URI.',
    example: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  })
  data: string;
}
