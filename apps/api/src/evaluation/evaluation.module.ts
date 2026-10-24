import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EvaluationController } from './evaluation.controller';

@Module({
  imports: [AuthModule],
  controllers: [EvaluationController],
})
export class EvaluationModule {}
