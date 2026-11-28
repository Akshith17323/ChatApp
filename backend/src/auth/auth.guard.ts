import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, matchesLegacyPassword, readBasicCredentials, verifyPassword } from './auth.util';

/**
 * Parses the Authorization header in the form:
 *   Authorization: Basic <base64(UTF-8 username:password)>
 *
 * USERNAME → unique identifier (stored as user.name)
 * PASSWORD → verified against a salted hash; legacy phone credentials migrate on correct login.
 *
 * If no matching user exists with that username, one is created automatically.
 * If user exists, password must match.
 * The resolved user is attached to request.user for downstream use.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  // shortcut: limits are per API process; use a shared edge limiter before running multiple replicas.
  private readonly attempts = new Map<string, { expiresAt: number; requests: number; failures: number }>();
  private nextCleanup = 0;
  private activeChecks = 0;

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    response.setHeader('Cache-Control', 'no-store');
    if (process.env.NODE_ENV === 'production' && !request.secure) {
      throw new ForbiddenException('HTTPS is required');
    }

    const now = Date.now();
    if (now >= this.nextCleanup) {
      for (const [ip, attempt] of this.attempts) {
        if (attempt.expiresAt <= now) this.attempts.delete(ip);
      }
      this.nextCleanup = now + 60_000;
    }
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    let attempt = this.attempts.get(ip);
    if (!attempt || attempt.expiresAt <= now) {
      if (!attempt && this.attempts.size >= 10_000) this.tooManyRequests();
      attempt = { expiresAt: now + 60_000, requests: 0, failures: 0 };
      this.attempts.set(ip, attempt);
    }
    if (++attempt.requests > 120 || attempt.failures >= 10 || this.activeChecks >= 4) this.tooManyRequests();

    this.activeChecks++;
    try {
      const { username, password } = readBasicCredentials(request.headers['authorization']);
      if (username.toLowerCase() === 'factbot') throw new UnauthorizedException('Invalid username or password');
      const user = await this.authenticate(username, password);
      request.user = { id: user.id, name: user.name };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        attempt.failures++;
        response.setHeader('WWW-Authenticate', 'Basic realm="ChatApp", charset="UTF-8"');
      }
      throw error;
    } finally {
      this.activeChecks--;
    }
  }

  private tooManyRequests(): never {
    throw new HttpException('Too many authentication attempts. Please try again in a minute.', HttpStatus.TOO_MANY_REQUESTS);
  }

  private async authenticate(username: string, password: string) {
    let user = await this.prisma.user.findUnique({
      where: { name: username },
    });

    if (!user) {
      if ([...password].length < 15) {
        throw new UnauthorizedException('New accounts need a password of at least 15 characters');
      }
      const passwordHash = await hashPassword(password);
      try {
        return await this.prisma.user.create({
          data: { name: username, passwordHash },
        });
      } catch (error) {
        if (error.code !== 'P2002') throw error;
        // A competing registration owns the name only if its credential also matches.
        user = await this.prisma.user.findUnique({ where: { name: username } });
      }
    }

    if (!user) throw new UnauthorizedException('Invalid username or password');
    if (user.passwordHash != null) {
      if (!await verifyPassword(password, user.passwordHash)) throw new UnauthorizedException('Invalid username or password');
      return user;
    }
    if (!user.phone || !matchesLegacyPassword(password, user.phone)) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const passwordHash = await hashPassword(password);
    const migrated = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        phone: user.phone,
        passwordHash: null,
      },
      data: { passwordHash, phone: null },
    });
    if (migrated.count !== 1) {
      user = await this.prisma.user.findUnique({ where: { id: user.id } });
      if (!user?.passwordHash || !await verifyPassword(password, user.passwordHash)) {
        throw new UnauthorizedException('Invalid username or password');
      }
    }
    return user;
  }
}
