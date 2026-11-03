import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadFileDto } from './dto/file.dto';
import { decodeBase64, detectImageMime, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from '../common/base64.util';
import { fetchRemoteFile } from '../common/remote-fetch.util';

/** Every field of a file except its contents. */
export const FILE_META_SELECT = {
  id: true,
  name: true,
  mimeType: true,
  size: true,
  kind: true,
  sourceUrl: true,
  uploadedBy: true,
  createdAt: true,
} as const;

type FileMeta = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: string;
  sourceUrl: string | null;
  uploadedBy: string;
  createdAt: Date;
};

/** Adds the download path to a file's metadata. */
export function toFileResponse(file: FileMeta) {
  return { ...file, downloadUrl: `/file/${file.id}/download` };
}

@Injectable()
export class FileService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Stores an upload sent as base64 (`data`) or as a link the server downloads (`url`),
   * after working out its MIME type and kind.
   * Images are checked against their bytes, so a renamed .exe cannot be sent as image/png.
   */
  async upload(dto: UploadFileDto, userId: string) {
    const hasData = dto.data !== undefined;
    const hasUrl = dto.url !== undefined;
    if (hasData === hasUrl) {
      throw new BadRequestException('Send exactly one of `data` (base64) or `url`');
    }

    let buffer: Buffer;
    let declaredMime: string | undefined;
    let fileName: string;
    let sourceUrl: string | null = null;

    if (hasUrl) {
      const remote = await fetchRemoteFile(dto.url!, { maxBytes: MAX_UPLOAD_BYTES });
      buffer = remote.buffer;
      // The client's mime_type wins over the remote server's header, which is often generic
      declaredMime = (dto.mime_type ?? remote.mimeType)?.toLowerCase();
      fileName = dto.file_name?.trim() || remote.fileName;
      sourceUrl = dto.url!;
    } else {
      const decoded = decodeBase64(dto.data!);
      buffer = decoded.buffer;
      if (dto.mime_type && decoded.mimeType && dto.mime_type.toLowerCase() !== decoded.mimeType) {
        throw new BadRequestException(
          `mime_type '${dto.mime_type}' does not match the data URL type '${decoded.mimeType}'`,
        );
      }
      declaredMime = (dto.mime_type ?? decoded.mimeType)?.toLowerCase();
      fileName = dto.file_name!.trim();
    }

    if (buffer.length === 0) {
      throw new BadRequestException('The file is empty');
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException(`Files can be at most ${MAX_UPLOAD_MB} MB`);
    }

    const detectedImage = detectImageMime(buffer);

    // A declared raster image must really be one. SVG is scriptable, so it is kept as a plain FILE.
    if (declaredMime?.startsWith('image/') && declaredMime !== 'image/svg+xml' && !detectedImage) {
      throw new BadRequestException(
        `The ${hasUrl ? 'downloaded file' : 'data'} is not a valid image (declared as ${declaredMime}). ` +
          'Supported images: PNG, JPEG, GIF, WebP, BMP, HEIC/HEIF.',
      );
    }

    const kind = detectedImage ? 'IMAGE' : 'FILE';
    // For images trust the bytes; otherwise use what the client declared.
    const mimeType = detectedImage ?? declaredMime ?? 'application/octet-stream';

    const file = await this.prisma.file.create({
      data: {
        name: fileName,
        mimeType,
        size: buffer.length,
        kind,
        data: new Uint8Array(buffer), // Prisma's Bytes type
        sourceUrl,
        uploadedBy: userId,
      },
      select: FILE_META_SELECT,
    });

    return toFileResponse(file);
  }

  /** Metadata plus the contents as base64. */
  async getWithData(fileId: string, userId: string) {
    const file = await this.findAccessible(fileId, userId);
    const { data, ...meta } = file;
    return { ...toFileResponse(meta), data: Buffer.from(data).toString('base64') };
  }

  /** Metadata plus the contents as a Buffer, for the download endpoint. */
  async getForDownload(fileId: string, userId: string) {
    return this.findAccessible(fileId, userId);
  }

  /**
   * A file can be read by the user who uploaded it, and by every participant
   * of a conversation where it was sent in a message.
   */
  private async findAccessible(fileId: string, userId: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw new NotFoundException(`File '${fileId}' not found`);
    }
    if (file.uploadedBy === userId) {
      return file;
    }

    const messages = await this.prisma.message.findMany({
      where: { fileId },
      select: { conversationId: true },
    });
    const conversationIds = [...new Set(messages.map((m) => m.conversationId))];

    if (conversationIds.length > 0) {
      const shared = await this.prisma.conversation.count({
        where: { id: { in: conversationIds }, participants_ids: { has: userId } },
      });
      if (shared > 0) return file;
    }

    throw new ForbiddenException('You do not have access to this file');
  }
}
