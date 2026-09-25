import { Controller, Get, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AGENT_STATES } from '@codepilot/types';
import { PLANNED_TOOLS, toolRuntime } from '@codepilot/tools';
import { SessionGuard } from '../auth/session.guard';

const PROVIDER_ID = 'openai-compatible';

@Controller('agent')
@UseGuards(SessionGuard)
export class AgentController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  status(): {
    provider: string | null;
    model: string | null;
    toolCount: number;
    toolExecution: boolean;
    states: typeof AGENT_STATES;
  } {
    const model = this.config.get<string>('LLM_MODEL');
    const configured = Boolean(this.config.get<string>('LLM_API_KEY') && model);
    return {
      provider: configured ? PROVIDER_ID : null,
      model: configured ? (model ?? null) : null,
      toolCount: PLANNED_TOOLS.length,
      toolExecution: toolRuntime.implemented,
      states: AGENT_STATES,
    };
  }
}
