import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { CodeSearchResponse, ImportedRepository } from '@codepilot/types';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard';
import { ImportRepositoryDto } from './import-repository.dto';
import { RepositoryFlowError, RepositoryService } from './repository.service';
import { SearchRepositoriesDto } from './search-repositories.dto';

const RESOURCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('repositories')
@UseGuards(SessionGuard)
export class RepositoriesController {
  constructor(private readonly repositories: RepositoryService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<ImportedRepository[]> {
    return this.repositories.list(request.currentUser.id);
  }

  @Get('github')
  available(@Req() request: AuthenticatedRequest) {
    return this.guard(() => this.repositories.available(request.currentUser.id));
  }

  @Post()
  importRepository(@Req() request: AuthenticatedRequest, @Body() body: ImportRepositoryDto) {
    return this.guard(() =>
      this.repositories.importRepository(request.currentUser.id, body.fullName),
    );
  }

  @Get(':id/status')
  async status(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const repository = await this.one(request, id);
    return {
      id: repository.id,
      status: repository.status,
      cloneError: repository.cloneError,
      indexing: repository.indexing,
      indexingError: repository.indexingError,
      indexTruncated: repository.indexTruncated,
      indexedAt: repository.indexedAt,
      fileCount: repository.fileCount,
      chunkCount: repository.chunkCount,
      embeddingModel: repository.embeddingModel,
    };
  }

  @Post(':id/index')
  @HttpCode(HttpStatus.ACCEPTED)
  index(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<ImportedRepository> {
    if (!RESOURCE_ID.test(id)) {
      throw new HttpException(
        { code: 'NOT_FOUND', message: 'That repository is not available to this account.' },
        HttpStatus.NOT_FOUND,
      );
    }
    return this.guard(() => this.repositories.requestIndex(request.currentUser.id, id));
  }

  @Get(':id/search')
  search(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Query() query: SearchRepositoriesDto,
  ): Promise<CodeSearchResponse> {
    if (!RESOURCE_ID.test(id)) {
      throw new HttpException(
        { code: 'NOT_FOUND', message: 'That repository is not available to this account.' },
        HttpStatus.NOT_FOUND,
      );
    }
    return this.guard(() => this.repositories.search(request.currentUser.id, id, query.q.trim()));
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string): Promise<ImportedRepository> {
    return this.one(request, id);
  }

  private async one(request: AuthenticatedRequest, id: string): Promise<ImportedRepository> {
    if (!RESOURCE_ID.test(id)) {
      throw new HttpException(
        { code: 'NOT_FOUND', message: 'That repository is not available to this account.' },
        HttpStatus.NOT_FOUND,
      );
    }
    return this.guard(() => this.repositories.get(request.currentUser.id, id));
  }

  private async guard<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof RepositoryFlowError)) {
        throw error;
      }
      if (error.reason === 'not_found') {
        throw new HttpException(
          { code: 'NOT_FOUND', message: 'That repository is not available to this account.' },
          HttpStatus.NOT_FOUND,
        );
      }
      if (error.reason === 'not_cloned') {
        throw new HttpException(
          { code: 'CLONE_REQUIRED', message: 'Clone the repository before indexing it.' },
          HttpStatus.CONFLICT,
        );
      }
      if (error.reason === 'queue_unavailable') {
        throw new HttpException(
          { code: 'INDEX_QUEUE_UNAVAILABLE', message: 'Indexing could not be queued.' },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      if (error.reason === 'not_connected') {
        throw new HttpException(
          {
            code: 'GITHUB_NOT_CONNECTED',
            message: 'Sign in with GitHub before importing a repository.',
          },
          HttpStatus.CONFLICT,
        );
      }
      throw new HttpException(
        { code: 'GITHUB_UNAVAILABLE', message: 'GitHub could not be reached.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
