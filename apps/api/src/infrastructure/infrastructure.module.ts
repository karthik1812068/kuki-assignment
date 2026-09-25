import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLogger } from '@codepilot/logger';
import { LOGGER } from '../logging/logger.token';
import { PostgresConnection } from './postgres.connection';
import { RedisConnection } from './redis.connection';

@Module({
  providers: [
    PostgresConnection,
    RedisConnection,
    {
      provide: LOGGER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createLogger('api', { level: config.getOrThrow<string>('LOG_LEVEL') }),
    },
  ],
  exports: [PostgresConnection, RedisConnection, LOGGER],
})
export class InfrastructureModule {}
