import { BadRequestException } from '@nestjs/common';

/**
 * Helpers for files sent as base64 strings.
 *
 * Clients may send either plain base64 ("iVBORw0KGgo...") or a data URL
 * ("data:image/png;base64,iVBORw0KGgo..."), which is what most mobile
 * pickers and FileReader.readAsDataURL() return.
 */

/** Largest upload accepted, in MB of decoded bytes (MongoDB documents are capped at 16 MB). */
export const MAX_UPLOAD_MB = Math.min(Number(process.env.MAX_UPLOAD_MB) || 10, 15);
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** JSON body limit: base64 is ~4/3 the size of the file, plus room for the other fields. */
export const JSON_BODY_LIMIT = `${Math.ceil((MAX_UPLOAD_MB * 4) / 3) + 1}mb`;

const DATA_URL = /^data:([\w.+-]+\/[\w.+-]+)?(?:;[\w-]+=[\w.+-]+)*;base64,/i;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

export interface DecodedBase64 {
  buffer: Buffer;
  /** MIME type from the data URL prefix, if there was one. */
  mimeType?: string;
}

/** Decodes plain base64 or a base64 data URL. Throws 400 on anything else. */
export function decodeBase64(input: string): DecodedBase64 {
  let payload = input.trim();
  let mimeType: string | undefined;

  const match = DATA_URL.exec(payload);
  if (match) {
    mimeType = match[1]?.toLowerCase();
    payload = payload.slice(match[0].length);
  } else if (payload.startsWith('data:')) {
    throw new BadRequestException('Only base64 data URLs are supported (data:<mime>;base64,<data>)');
  }

  payload = payload.replace(/\s/g, ''); // some encoders wrap lines

  if (!payload || payload.length % 4 !== 0 || !BASE64.test(payload)) {
    throw new BadRequestException('`data` is not valid base64');
  }

  return { buffer: Buffer.from(payload, 'base64'), mimeType };
}

/**
 * Recognises common image formats from their first bytes ("magic numbers").
 * Returns the matching MIME type, or null if the bytes are not a known image.
 */
export function detectImageMime(buf: Buffer): string | null {
  const ascii = (start: number, end: number) => buf.subarray(start, end).toString('latin1');

  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) return 'image/gif';
  if (buf.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (buf.length >= 2 && ascii(0, 2) === 'BM') return 'image/bmp';
  if (buf.length >= 12 && ascii(4, 8) === 'ftyp') {
    // HEIC / HEIF — the default photo format on iPhones
    const brand = ascii(8, 12);
    if (['heic', 'heix', 'hevc', 'heim', 'heis'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1', 'heif'].includes(brand)) return 'image/heif';
  }
  return null;
}
