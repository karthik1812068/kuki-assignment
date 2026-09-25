import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('health')
  liveness(): { status: 'ok'; service: 'api' } {
    return this.health.liveness();
  }

  @Get('ready')
  async readiness(@Res({ passthrough: true }) response: Response) {
    const report = await this.health.readiness();
    response.status(report.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return report;
  }
}
