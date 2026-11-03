import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as zlib from 'zlib';
import { Readable } from 'stream';

/**
 * Downloads a file from a URL that a user gave us ("upload by remote URL").
 *
 * The server is fetching an address chosen by a client, so it must not become a
 * way to reach things only the server can see (localhost, the Docker network,
 * MongoDB, cloud metadata at 169.254.169.254, ...). That attack is called SSRF.
 * The protections here:
 *   - only http:// and https://, no user:password@ in the URL
 *   - every address the host name resolves to must be a public internet address;
 *     the check runs inside the socket's DNS lookup, so the address that is checked
 *     is the address that is connected to (no DNS-rebinding window)
 *   - redirects are followed by hand (at most MAX_REDIRECTS) and each hop is checked again
 *   - a total time limit, and the download stops as soon as it passes the size limit
 */

const MAX_REDIRECTS = 3;
export const REMOTE_FETCH_TIMEOUT_MS = Number(process.env.REMOTE_FETCH_TIMEOUT_MS) || 15_000;

export interface RemoteFile {
  buffer: Buffer;
  /** MIME type from the Content-Type header, without parameters. */
  mimeType?: string;
  /** File name from Content-Disposition, or the last part of the URL path. */
  fileName: string;
  /** The URL the bytes finally came from (after redirects). */
  finalUrl: string;
}

export interface RemoteFetchOptions {
  maxBytes: number;
  timeoutMs?: number;
  /** Decides which IP addresses may be connected to. Defaults to public addresses only. */
  isAllowedAddress?: (ip: string) => boolean;
}

// ─── Which addresses count as "public" ────────────────────────────────────────

const blocked = new net.BlockList();
for (const [prefix, bits] of [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // private (Docker uses this range)
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, broadcast
] as const) {
  blocked.addSubnet(prefix, bits, 'ipv4');
}
for (const [prefix, bits] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['64:ff9b::', 96], // NAT64 (wraps an IPv4 address)
  ['64:ff9b:1::', 48], // local-use NAT64
  ['100::', 64], // discard
  ['2001::', 32], // Teredo
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4 (wraps an IPv4 address)
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['fec0::', 10], // old site-local
  ['ff00::', 8], // multicast
] as const) {
  blocked.addSubnet(prefix, bits, 'ipv6');
}

/** True for addresses on the public internet; false for loopback, private, link-local and reserved ranges. */
export function isPublicAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return !blocked.check(ip, 'ipv4');
  if (family !== 6) return false;

  // IPv4-mapped / IPv4-compatible IPv6 (::ffff:127.0.0.1, ::ffff:7f00:1) → check the IPv4 inside
  const lower = ip.toLowerCase();
  const mapped = /^(?:0*:)*(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return isPublicAddress(mapped[1]);
  const mappedHex = /^(?:0*:)*ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPublicAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (blocked.check(ip, 'ipv6')) return false;
  // Only global unicast (2000::/3) is public
  return /^[23]/.test(lower);
}

// ─── Download ─────────────────────────────────────────────────────────────────

export async function fetchRemoteFile(rawUrl: string, options: RemoteFetchOptions): Promise<RemoteFile> {
  const isAllowed = options.isAllowedAddress ?? isPublicAddress;
  const timeoutMs = options.timeoutMs ?? REMOTE_FETCH_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  let url = parseRemoteUrl(rawUrl);
  for (let hop = 0; ; hop++) {
    const response = await request(url, isAllowed, deadline, timeoutMs);
    const status = response.statusCode ?? 0;

    if (status >= 300 && status < 400 && response.headers.location) {
      response.resume(); // discard the redirect body
      if (hop >= MAX_REDIRECTS) {
        throw new BadRequestException(`The URL redirected more than ${MAX_REDIRECTS} times`);
      }
      url = parseRemoteUrl(new URL(response.headers.location, url).toString());
      continue;
    }
    if (status < 200 || status >= 300) {
      response.resume();
      throw new BadRequestException(`Could not download the URL: the remote server answered ${status}`);
    }

    const buffer = await readBody(response, options.maxBytes, deadline, timeoutMs);
    return {
      buffer,
      mimeType: parseContentType(response.headers['content-type']),
      fileName: fileNameFrom(response.headers['content-disposition'], url),
      finalUrl: url.toString(),
    };
  }
}

/** Only absolute http(s) URLs without credentials; IP-literal hosts are checked here (they skip DNS). */
function parseRemoteUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('`url` is not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('Only http:// and https:// URLs can be downloaded');
  }
  if (url.username || url.password) {
    throw new BadRequestException('URLs with a user name or password are not allowed');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && !isPublicAddress(host)) {
    throw new BadRequestException('That URL points to a private or local address');
  }
  return url;
}

function request(
  url: URL,
  isAllowed: (ip: string) => boolean,
  deadline: number,
  timeoutMs: number,
): Promise<http.IncomingMessage> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(timeoutError(timeoutMs));

  // Runs when the socket resolves the host name: every resolved address must be allowed.
  const lookup: net.LookupFunction = (hostname, lookupOptions, callback) => {
    dns.lookup(hostname, { ...lookupOptions, all: true }, (err, addresses) => {
      if (err) return callback(err, '', 0);
      const list = addresses as dns.LookupAddress[];
      if (list.length === 0 || list.some((a) => !isAllowed(a.address))) {
        const blockedErr = Object.assign(new Error('blocked address'), { code: 'EBLOCKEDADDRESS' });
        return callback(blockedErr, '', 0);
      }
      if ((lookupOptions as dns.LookupOptions).all) {
        (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
      } else {
        callback(null, list[0].address, list[0].family);
      }
    });
  };

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && !isAllowed(host)) {
    return Promise.reject(new BadRequestException('That URL points to a private or local address'));
  }

  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(
      url,
      {
        lookup,
        agent: false, // no shared sockets, so no connection reuse across checked/unchecked hosts
        headers: {
          'User-Agent': 'ChatAppBackend/1.0 (+remote-url-upload)',
          Accept: '*/*',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      },
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
    );
    // Total time limit until the response headers arrive (readBody has its own for the body)
    const timer = setTimeout(() => req.destroy(timeoutError(timeoutMs)), remaining);
    req.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(toHttpError(err));
    });
  });
}

function readBody(
  response: http.IncomingMessage,
  maxBytes: number,
  deadline: number,
  timeoutMs: number,
): Promise<Buffer> {
  const tooLarge = () => new PayloadTooLargeException(`Files can be at most ${Math.round(maxBytes / 1024 / 1024)} MB`);

  const declared = Number(response.headers['content-length']);
  if (Number.isFinite(declared) && declared > maxBytes && !response.headers['content-encoding']) {
    response.destroy();
    return Promise.reject(tooLarge());
  }

  // Decompress if the server compressed the body; the size limit applies to the decompressed bytes.
  let body: Readable = response;
  const encoding = String(response.headers['content-encoding'] ?? 'identity').toLowerCase().trim();
  if (encoding === 'gzip' || encoding === 'x-gzip') body = response.pipe(zlib.createGunzip());
  else if (encoding === 'deflate') body = response.pipe(zlib.createInflate());
  else if (encoding === 'br') body = response.pipe(zlib.createBrotliDecompress());
  else if (encoding !== 'identity') {
    response.destroy();
    return Promise.reject(new BadRequestException(`The remote server used an unsupported encoding (${encoding})`));
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    const fail = (err: unknown) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      response.destroy();
      body.destroy();
      reject(err);
    };
    const timer = setTimeout(() => fail(timeoutError(timeoutMs)), Math.max(deadline - Date.now(), 0));

    body.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) return fail(tooLarge());
      chunks.push(chunk);
    });
    body.on('end', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
    body.on('error', () => fail(new BadRequestException('The download was interrupted or could not be decompressed')));
    response.on('aborted', () => fail(new BadRequestException('The remote server closed the connection early')));
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeoutError(timeoutMs: number) {
  return new BadRequestException(
    `The download took longer than ${Math.round(timeoutMs / 100) / 10} seconds and was stopped`,
  );
}

function toHttpError(err: NodeJS.ErrnoException) {
  if (err instanceof BadRequestException || err instanceof PayloadTooLargeException) return err;
  switch (err.code) {
    case 'EBLOCKEDADDRESS':
      return new BadRequestException('That URL points to a private or local address');
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return new BadRequestException('Could not download the URL: the host name was not found');
    case 'ECONNREFUSED':
    case 'ECONNRESET':
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return new BadRequestException('Could not download the URL: the remote server could not be reached');
    default:
      if (err.code?.startsWith('ERR_TLS') || /certificate/i.test(err.message)) {
        return new BadRequestException('Could not download the URL: its HTTPS certificate is not valid');
      }
      return new BadRequestException('Could not download the URL');
  }
}

function parseContentType(header: string | undefined): string | undefined {
  const type = header?.split(';')[0].trim().toLowerCase();
  return type && /^[\w.+-]+\/[\w.+-]+$/.test(type) ? type : undefined;
}

/** File name from Content-Disposition, else the last URL path segment, else "download". */
function fileNameFrom(disposition: string | undefined, url: URL): string {
  let name: string | undefined;

  if (disposition) {
    const star = /filename\*\s*=\s*(?:[\w-]+)?'[^']*'([^;]+)/i.exec(disposition);
    const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(disposition);
    try {
      name = star ? decodeURIComponent(star[1].trim()) : (plain?.[1] ?? plain?.[2])?.trim();
    } catch {
      name = undefined;
    }
  }
  if (!name) {
    const segment = url.pathname.split('/').filter(Boolean).pop();
    try {
      name = segment ? decodeURIComponent(segment) : undefined;
    } catch {
      name = segment;
    }
  }

  // No folders, no control characters, at most 255 characters
  const clean = (name ?? '')
    .split(/[/\\]/)
    .pop()!
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
    .slice(0, 255);
  return clean && clean !== '.' && clean !== '..' ? clean : 'download';
}
