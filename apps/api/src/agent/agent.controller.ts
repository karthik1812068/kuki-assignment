import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readWorkSnapshot, type WorkSnapshot } from '@codepilot/database';
import { AGENT_STATES } from '@codepilot/types';
import { PLANNED_TOOLS, toolRuntime } from '@codepilot/tools';
import { SessionGuard } from '../auth/session.guard';
import { RedisConnection } from '../infrastructure/redis.connection';

const PROVIDER_ID = 'openai-compatible';

const EMPTY_WORK: WorkSnapshot = {
  index: { waiting: 0, processing: 0, dead: 0 },
  task: { waiting: 0, processing: 0, dead: 0 },
  documents: { waiting: 0, processing: 0, dead: 0 },
  workerSeenAt: null,
  workerLive: false,
};

@Controller('agent')
@UseGuards(SessionGuard)
export class AgentController {
  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisConnection,
  ) {}

  @Get()
  async status(): Promise<{
    provider: string | null;
    model: string | null;
    toolCount: number;
    toolExecution: boolean;
    states: typeof AGENT_STATES;
    work: WorkSnapshot;
  }> {
    const model = this.config.get<string>('LLM_MODEL');
    const configured = Boolean(this.config.get<string>('LLM_API_KEY') && model);
    return {
      provider: configured ? PROVIDER_ID : null,
      model: configured ? (model ?? null) : null,
      toolCount: PLANNED_TOOLS.length,
      toolExecution: toolRuntime.implemented,
      states: AGENT_STATES,
      work: await this.workSnapshot(),
    };
  }

  private async workSnapshot(): Promise<WorkSnapshot> {
    try {
      return await readWorkSnapshot(this.redis.client);
    } catch {
      return EMPTY_WORK;
    }
  }
}
