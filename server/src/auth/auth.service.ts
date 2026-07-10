import {
  createHmac,
  randomBytes,
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
import { eq, sql } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { players } from '../db/schema';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天
const UID_MAX = 999;

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
    if (!/^\d{3}$/.test(playerId)) return null;

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

  /** 顺序分配三位 UID：001 … 999 */
  private async allocateUid(): Promise<string> {
    const db = this.requireDb();
    const result = await db.execute<{ nextval: string | number }>(
      sql`SELECT nextval('player_uid_seq') AS nextval`,
    );
    const n = Number(result.rows[0]?.nextval);
    if (!Number.isFinite(n) || n < 1 || n > UID_MAX) {
      throw new ConflictException('玩家 UID 已满（最多 999）');
    }
    return String(n).padStart(3, '0');
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

    const playerId = await this.allocateUid();
    await db.insert(players).values({
      id: playerId,
      username: normalized,
      passwordHash: this.hashPassword(password),
    });

    this.logger.log(`Registered player username=${normalized} uid=${playerId}`);
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

    this.logger.log(`Login username=${normalized} uid=${row.id}`);
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

  async updateAccount(
    playerId: string,
    patch: {
      username?: string;
      currentPassword: string;
      newPassword?: string;
    },
  ): Promise<AuthSession> {
    const db = this.requireDb();
    const rows = await db
      .select({
        id: players.id,
        username: players.username,
        passwordHash: players.passwordHash,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    const row = rows[0];
    if (!row?.passwordHash || !this.verifyPassword(patch.currentPassword, row.passwordHash)) {
      throw new UnauthorizedException('当前密码不正确');
    }

    const set: Partial<typeof players.$inferInsert> = {
      updatedAt: new Date(),
    };

    let nextUsername = row.username ?? '';
    if (patch.username !== undefined) {
      const normalized = this.normalizeUsername(patch.username);
      if (normalized !== row.username) {
        const clash = await db
          .select({ id: players.id })
          .from(players)
          .where(eq(players.username, normalized))
          .limit(1);
        if (clash.length > 0) {
          throw new ConflictException('用户名已被占用');
        }
        set.username = normalized;
        nextUsername = normalized;
      }
    }

    if (patch.newPassword !== undefined) {
      set.passwordHash = this.hashPassword(patch.newPassword);
    }

    await db.update(players).set(set).where(eq(players.id, playerId));
    this.logger.log(`Account updated uid=${playerId} username=${nextUsername}`);

    return {
      playerId,
      username: nextUsername,
      token: this.signToken(playerId),
    };
  }

  async getAccount(playerId: string): Promise<{
    id: string;
    username: string;
    createdAt: string;
    updatedAt: string;
  } | null> {
    const db = this.dbService.isReady ? this.dbService.db : null;
    if (!db) return null;
    const rows = await db
      .select({
        id: players.id,
        username: players.username,
        createdAt: players.createdAt,
        updatedAt: players.updatedAt,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    const row = rows[0];
    if (!row?.username) return null;
    return {
      id: row.id,
      username: row.username,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
