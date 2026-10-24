import { Controller, Get, UseGuards } from '@nestjs/common';
import { findRepoRoot } from '@codepilot/config';
import { barRaiserReport, compactBarRaiser } from '@codepilot/indexing';
import { SessionGuard } from '../auth/session.guard';

@Controller('evaluation')
@UseGuards(SessionGuard)
export class EvaluationController {
  @Get()
  report() {
    return compactBarRaiser(barRaiserReport(findRepoRoot(process.cwd())));
  }
}
