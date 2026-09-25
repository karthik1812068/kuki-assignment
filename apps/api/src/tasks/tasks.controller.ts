import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard';
import { CreateTaskDto } from './create-task.dto';
import { DecideTaskDto } from './decide-task.dto';
import { TaskFlowError, TaskService } from './task.service';

const RESOURCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

@Controller('tasks')
@UseGuards(SessionGuard)
export class TasksController {
  constructor(private readonly tasks: TaskService) {}

  @Get('summary')
  summary(@Req() request: AuthenticatedRequest) {
    return this.guard(() => this.tasks.summary(request.currentUser.id));
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.guard(async () => {
      const tasks = await this.tasks.list(request.currentUser.id);
      return tasks.map(summarize);
    });
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Req() request: AuthenticatedRequest, @Body() body: CreateTaskDto) {
    return this.guard(async () => {
      const task = await this.tasks.create(request.currentUser.id, body, clientIp(request));
      return summarize(task);
    });
  }

  @Get(':id')
  detail(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    this.assertId(id);
    return this.guard(() => this.tasks.details(request.currentUser.id, id));
  }

  @Post(':id/decision')
  decide(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: DecideTaskDto,
  ) {
    this.assertId(id);
    return this.guard(async () => {
      const task = await this.tasks.decide(
        request.currentUser.id,
        id,
        body.decision,
        clientIp(request),
      );
      return summarize(task);
    });
  }

  @Get(':id/events')
  async events(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Res() response: Response,
  ): Promise<void> {
    this.assertId(id);
    response.setHeader('content-type', 'text/event-stream');
    response.setHeader('cache-control', 'no-cache');
    response.flushHeaders();
    for (let attempt = 0; attempt < 15; attempt += 1) {
      try {
        const details = await this.tasks.details(request.currentUser.id, id);
        response.write(
          `data: ${JSON.stringify({ status: details.status, outcome: details.outcome })}\n\n`,
        );
        if (TERMINAL.has(details.status) || details.pendingGate) {
          break;
        }
      } catch {
        response.write('event: error\ndata: {"code":"NOT_FOUND"}\n\n');
        break;
      }
      await delay(2_000);
    }
    response.end();
  }

  private assertId(id: string): void {
    if (!RESOURCE_ID.test(id)) {
      throw new HttpException(
        { code: 'NOT_FOUND', message: 'That task is not available to this account.' },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async guard<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof TaskFlowError) {
        throw new HttpException(taskError(error.reason), statusFor(error.reason));
      }
      throw error;
    }
  }
}

function summarize(task: {
  id: string;
  repositoryId: string;
  title: string;
  mode: string;
  status: string;
  outcome: string | null;
  error: string | null;
  pendingGate: string | null;
  createdAt: Date;
}): {
  id: string;
  repositoryId: string;
  title: string;
  mode: string;
  status: string;
  outcome: string | null;
  error: string | null;
  pendingGate: string | null;
  createdAt: string;
} {
  return {
    id: task.id,
    repositoryId: task.repositoryId,
    title: task.title,
    mode: task.mode,
    status: task.status,
    outcome: task.outcome,
    error: task.error,
    pendingGate: task.pendingGate,
    createdAt: task.createdAt.toISOString(),
  };
}

function taskError(reason: TaskFlowError['reason']): { code: string; message: string } {
  switch (reason) {
    case 'not_cloned':
      return { code: 'CLONE_REQUIRED', message: 'Clone the repository before creating a task.' };
    case 'queue_unavailable':
      return { code: 'TASK_QUEUE_UNAVAILABLE', message: 'The task could not be queued.' };
    case 'rate_limited':
      return { code: 'RATE_LIMITED', message: 'Too many tasks were created. Try again later.' };
    case 'invalid':
      return { code: 'INVALID_INPUT', message: 'The task could not be accepted.' };
    default:
      return { code: 'NOT_FOUND', message: 'That task is not available to this account.' };
  }
}

function statusFor(reason: TaskFlowError['reason']): HttpStatus {
  switch (reason) {
    case 'not_cloned':
      return HttpStatus.CONFLICT;
    case 'queue_unavailable':
      return HttpStatus.SERVICE_UNAVAILABLE;
    case 'rate_limited':
      return HttpStatus.TOO_MANY_REQUESTS;
    case 'invalid':
      return HttpStatus.BAD_REQUEST;
    default:
      return HttpStatus.NOT_FOUND;
  }
}

function clientIp(request: AuthenticatedRequest): string | null {
  const address = request.socket?.remoteAddress;
  return typeof address === 'string' ? address.slice(0, 64) : null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
