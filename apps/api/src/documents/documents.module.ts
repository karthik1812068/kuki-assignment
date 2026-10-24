import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { documentStorageDir } from '@codepilot/config';
import { PgDocumentStore } from '@codepilot/database';
import { AuthModule } from '../auth/auth.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { PostgresConnection } from '../infrastructure/postgres.connection';
import { RedisConnection } from '../infrastructure/redis.connection';
import { DocumentService } from './document.service';
import { DocumentsController } from './documents.controller';

@Module({
  imports: [InfrastructureModule, AuthModule],
  controllers: [DocumentsController],
  providers: [
    {
      provide: PgDocumentStore,
      inject: [PostgresConnection],
      useFactory: (postgres: PostgresConnection) => new PgDocumentStore(postgres.pool),
    },
    {
      provide: DocumentService,
      inject: [PgDocumentStore, RedisConnection, ConfigService],
      useFactory: (documents: PgDocumentStore, redis: RedisConnection, config: ConfigService) =>
        new DocumentService(
          documents,
          redis.client,
          documentStorageDir({
            REPOSITORIES_DIR: config.get<string>('REPOSITORIES_DIR'),
          }),
        ),
    },
  ],
})
export class DocumentsModule {}
