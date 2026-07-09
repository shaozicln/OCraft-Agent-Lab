import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type AppDatabase = NodePgDatabase<typeof schema>;

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);
  private pool: Pool | null = null;
  private _db: AppDatabase | null = null;

  get db(): AppDatabase {
    if (!this._db) {
      throw new Error(
        'Database not initialized. Set DATABASE_URL and run npm run db:migrate.',
      );
    }
    return this._db;
  }

  get isReady(): boolean {
    return this._db !== null;
  }

  onModuleInit() {
    const url = process.env.DATABASE_URL;
    if (!url) {
      this.logger.warn(
        'DATABASE_URL not set — player persistence disabled until configured.',
      );
      return;
    }

    this.pool = new Pool({ connectionString: url });
    this._db = drizzle(this.pool, { schema });
    this.logger.log('PostgreSQL connected');
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }
}
