import { UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// OWASP's 32 MiB scrypt profile keeps per-request Basic authentication bounded.
const SCRYPT = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const HASH_PREFIX = 'scrypt$32768$8$3';

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, SCRYPT, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `${HASH_PREFIX}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const match = /^scrypt\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(encoded);
  if (!match) return false;
  const key = await derive(password, Buffer.from(match[1], 'hex'));
  return timingSafeEqual(key, Buffer.from(match[2], 'hex'));
}

export function matchesLegacyPassword(password: string, stored: string) {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(password), digest(stored));
}

export function readBasicCredentials(header: unknown) {
  const invalid = () => new UnauthorizedException('Invalid username or password');
  if (typeof header !== 'string' || header.length > 4096) throw invalid();
  const match = /^Basic (.+)$/i.exec(header);
  if (!match) throw invalid();

  let credentials = match[1];
  // shortcut: accept the old literal header during rollout; remove after old clients are retired.
  if (!credentials.includes(':')) {
    const bytes = Buffer.from(credentials, 'base64');
    credentials = bytes.toString('utf8');
    if (bytes.toString('base64') !== match[1] || !Buffer.from(credentials).equals(bytes)) throw invalid();
  }

  const colon = credentials.indexOf(':');
  const username = credentials.slice(0, colon).trim();
  const password = credentials.slice(colon + 1);
  if (colon < 1 || !username || /[\u0000-\u001f\u007f]/.test(username) ||
      username.length > 128 || !password.trim() || Buffer.byteLength(password) > 1024) {
    throw invalid();
  }
  return { username, password };
}
