import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AgentController } from './agent.controller';

@Module({
  imports: [AuthModule],
  controllers: [AgentController],
})
export class AgentModule {}
