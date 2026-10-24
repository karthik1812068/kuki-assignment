import { MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { parseFoundationEnv } from '@codepilot/config';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { AgentModule } from './agent/agent.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { TasksModule } from './tasks/tasks.module';
import { DocumentsModule } from './documents/documents.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validate: (env) => parseFoundationEnv(env),
    }),
    InfrastructureModule,
    HealthModule,
    AuthModule,
    AgentModule,
    RepositoriesModule,
    TasksModule,
    DocumentsModule,
    EvaluationModule,
  ],
  providers: [
    RequestContextMiddleware,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes({
      path: '{*path}',
      method: RequestMethod.ALL,
    });
  }
}
