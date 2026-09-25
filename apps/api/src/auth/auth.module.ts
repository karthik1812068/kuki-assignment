import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgAuthRepository } from '@codepilot/database';
import { GitHubOAuthClient } from '@codepilot/github';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { PostgresConnection } from '../infrastructure/postgres.connection';
import { RedisConnection } from '../infrastructure/redis.connection';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RedisOAuthStateStore } from './oauth-state.store';
import { SessionGuard } from './session.guard';

@Module({
  imports: [InfrastructureModule],
  controllers: [AuthController],
  exports: [AuthService, SessionGuard, PgAuthRepository],
  providers: [
    SessionGuard,
    {
      provide: PgAuthRepository,
      inject: [PostgresConnection],
      useFactory: (postgres: PostgresConnection) => new PgAuthRepository(postgres.pool),
    },
    {
      provide: AuthService,
      inject: [PgAuthRepository, RedisConnection, ConfigService],
      useFactory: (store: PgAuthRepository, redis: RedisConnection, config: ConfigService) => {
        const clientId = config.get<string>('GITHUB_CLIENT_ID');
        const clientSecret = config.get<string>('GITHUB_CLIENT_SECRET');
        const callbackUrl = config.get<string>('GITHUB_CALLBACK_URL');
        const github =
          clientId && clientSecret && callbackUrl
            ? new GitHubOAuthClient({ clientId, clientSecret, callbackUrl })
            : null;
        return new AuthService({
          store,
          states: new RedisOAuthStateStore(redis.client),
          github,
          encryptionKey: config.get<string>('ENCRYPTION_KEY'),
        });
      },
    },
  ],
})
export class AuthModule {}
