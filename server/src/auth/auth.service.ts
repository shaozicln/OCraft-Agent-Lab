import {
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'crypto';
import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthSession } from '@ocraft/shared';
import { eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { players } from '../db/schema';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly dbService: DbService) {}

  private get secret(): string {
    return process.env.AUTH_SECRET ?? 'dev-auth-secret-change-me';
  }

  normalizeUsername(username: string): string {
    return username.trim().toLowerCase();
  }

  hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const hashBuf = Buffer.from(hash, 'hex');
    const derived = scryptSync(password, salt, 64);
    if (hashBuf.length !== derived.length) return false;
    return timingSafeEqual(hashBuf, derived);
  }

  signToken(playerId: string): string {
    const exp = Date.now() + TOKEN_TTL_MS;
    const payload = `${playerId}.${exp}`;
    const sig = createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');
    return `${payload}.${sig}`;
  }

  verifyToken(token: string): { playerId: string } | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [playerId, expStr, sig] = parts;
    const exp = Number(expStr);
    if (!playerId || !Number.isFinite(exp) || !sig) return null;
    if (Date.now() > exp) return null;

    const payload = `${playerId}.${expStr}`;
    const expected = createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    return { playerId };
  }

  private requireDb() {
    if (!this.dbService.isReady) {
      throw new UnauthorizedException(
        'Database not available. Set DATABASE_URL and run npm run db:migrate.',
      );
    }
    return this.dbService.db;
  }

  async register(username: string, password: string): Promise<AuthSession> {
    const db = this.requireDb();
    const normalized = this.normalizeUsername(username);

    const existing = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.username, normalized))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('用户名已被占用');
    }

    const playerId = randomUUID();
    await db.insert(players).values({
      id: playerId,
      username: normalized,
      passwordHash: this.hashPassword(password),
      extra: {},
    });

    this.logger.log(`Registered player username=${normalized} id=${playerId}`);
    return {
      playerId,
      username: normalized,
      token: this.signToken(playerId),
    };
  }

  async login(username: string, password: string): Promise<AuthSession> {
    const db = this.requireDb();
    const normalized = this.normalizeUsername(username);

    const rows = await db
      .select({
        id: players.id,
        username: players.username,
        passwordHash: players.passwordHash,
      })
      .from(players)
      .where(eq(players.username, normalized))
      .limit(1);

    const row = rows[0];
    if (!row?.passwordHash || !this.verifyPassword(password, row.passwordHash)) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    this.logger.log(`Login username=${normalized} id=${row.id}`);
    return {
      playerId: row.id,
      username: row.username ?? normalized,
      token: this.signToken(row.id),
    };
  }

  async resolveSession(token: string): Promise<AuthSession | null> {
    const verified = this.verifyToken(token);
    if (!verified) return null;

    const db = this.dbService.db;
    if (!db) return null;

    const rows = await db
      .select({ id: players.id, username: players.username })
      .from(players)
      .where(eq(players.id, verified.playerId))
      .limit(1);

    const row = rows[0];
    if (!row?.username) return null;

    return {
      playerId: row.id,
      username: row.username,
      token,
    };
  }
}
