import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';
import { AgentController } from './agent.controller';

@Module({
  imports: [AuthModule, InfrastructureModule],
  controllers: [AgentController],
})
export class AgentModule {}
