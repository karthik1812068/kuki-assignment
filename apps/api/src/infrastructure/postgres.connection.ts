import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPostgresPool } from '@codepilot/database';

@Injectable()
export class PostgresConnection implements OnModuleDestroy {
  readonly pool: ReturnType<typeof createPostgresPool>;

  constructor(config: ConfigService) {
    this.pool = createPostgresPool(config.getOrThrow<string>('DATABASE_URL'));
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
