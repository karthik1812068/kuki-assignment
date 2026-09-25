import { Inject, Injectable } from '@nestjs/common';
import { pingPostgres, pingRedis } from '@codepilot/database';
import { errorMessage, type Logger } from '@codepilot/logger';
import type { HealthReport } from '@codepilot/types';
import { LOGGER } from '../logging/logger.token';
import { PostgresConnection } from '../infrastructure/postgres.connection';
import { RedisConnection } from '../infrastructure/redis.connection';
import { runHealthChecks } from './run-health-checks';

@Injectable()
export class HealthService {
  constructor(
    private readonly postgres: PostgresConnection,
    private readonly redis: RedisConnection,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  liveness(): { status: 'ok'; service: 'api' } {
    return { status: 'ok', service: 'api' };
  }

  async readiness(): Promise<HealthReport> {
    return runHealthChecks('api', {
      database: () => this.check('database', () => pingPostgres(this.postgres.pool)),
      redis: () => this.check('redis', () => pingRedis(this.redis.client)),
    });
  }

  private async check(dependency: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      this.logger.error({ dependency, message: errorMessage(error) }, 'readiness check failed');
      throw error;
    }
  }
}
