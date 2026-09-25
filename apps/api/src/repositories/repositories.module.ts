import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { repositoryStorageDir } from '@codepilot/config';
import { enqueueIndexJob, PgIndexStore, PgRepositoryStore } from '@codepilot/database';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { PostgresConnection } from '../infrastructure/postgres.connection';
import { RedisConnection } from '../infrastructure/redis.connection';
import { RepositoriesController } from './repositories.controller';
import { RepositoryService } from './repository.service';

@Module({
  imports: [InfrastructureModule, AuthModule],
  controllers: [RepositoriesController],
  providers: [
    {
      provide: PgRepositoryStore,
      inject: [PostgresConnection],
      useFactory: (postgres: PostgresConnection) => new PgRepositoryStore(postgres.pool),
    },
    {
      provide: PgIndexStore,
      inject: [PostgresConnection],
      useFactory: (postgres: PostgresConnection) => new PgIndexStore(postgres.pool),
    },
    {
      provide: RepositoryService,
      inject: [AuthService, PgRepositoryStore, PgIndexStore, RedisConnection, ConfigService],
      useFactory: (
        auth: AuthService,
        store: PgRepositoryStore,
        indexes: PgIndexStore,
        redis: RedisConnection,
        config: ConfigService,
      ) =>
        new RepositoryService({
          auth,
          store,
          indexes,
          queue: { enqueue: (job) => enqueueIndexJob(redis.client, job) },
          storageDir: repositoryStorageDir({
            REPOSITORIES_DIR: config.get<string>('REPOSITORIES_DIR'),
          }),
        }),
    },
  ],
})
export class RepositoriesModule {}
