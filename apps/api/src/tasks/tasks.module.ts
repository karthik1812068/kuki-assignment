import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgRepositoryStore, PgTaskStore } from '@codepilot/database';
import { AuthModule } from '../auth/auth.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { PostgresConnection } from '../infrastructure/postgres.connection';
import { RedisConnection } from '../infrastructure/redis.connection';
import { TaskService } from './task.service';
import { TasksController } from './tasks.controller';

@Module({
  imports: [InfrastructureModule, AuthModule],
  controllers: [TasksController],
  providers: [
    {
      provide: PgTaskStore,
      inject: [PostgresConnection],
      useFactory: (postgres: PostgresConnection) => new PgTaskStore(postgres.pool),
    },
    {
      provide: PgRepositoryStore,
      inject: [PostgresConnection],
      useFactory: (postgres: PostgresConnection) => new PgRepositoryStore(postgres.pool),
    },
    {
      provide: TaskService,
      inject: [PgTaskStore, PgRepositoryStore, RedisConnection, ConfigService],
      useFactory: (
        tasks: PgTaskStore,
        repositories: PgRepositoryStore,
        redis: RedisConnection,
        config: ConfigService,
      ) =>
        new TaskService(
          tasks,
          repositories,
          redis.client,
          config.get<number>('TASK_RATE_LIMIT') ?? 20,
          config.get<string>('LLM_API_KEY') && config.get<string>('LLM_MODEL')
            ? (config.get<string>('LLM_MODEL') ?? null)
            : null,
        ),
    },
  ],
})
export class TasksModule {}
