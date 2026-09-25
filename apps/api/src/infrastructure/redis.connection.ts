import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { closeRedis, createRedisClient, pingRedis } from '@codepilot/database';

@Injectable()
export class RedisConnection implements OnModuleInit, OnModuleDestroy {
  readonly client: ReturnType<typeof createRedisClient>;

  constructor(config: ConfigService) {
    this.client = createRedisClient(config.getOrThrow<string>('REDIS_URL'));
  }

  async onModuleInit(): Promise<void> {
    await pingRedis(this.client);
  }

  async onModuleDestroy(): Promise<void> {
    await closeRedis(this.client);
  }
}
