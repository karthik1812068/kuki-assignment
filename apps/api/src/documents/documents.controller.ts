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
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SessionGuard, type AuthenticatedRequest } from '../auth/session.guard';
import { AskDocumentDto } from './ask-document.dto';
import { DocumentFlowError, DocumentService, type UploadedDocument } from './document.service';

const RESOURCE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('documents')
@UseGuards(SessionGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.guard(async () => {
      const rows = await this.documents.list(request.currentUser.id);
      return rows.map(publicDocument);
    });
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FilesInterceptor('files', 12, {
      storage: memoryStorage(),
      limits: { fileSize: 12 * 1024 * 1024, files: 12 },
    }),
  )
  upload(
    @Req() request: AuthenticatedRequest,
    @UploadedFiles() files: UploadedDocument[] | undefined,
  ) {
    return this.guard(async () => {
      const rows = await this.documents.upload(request.currentUser.id, files ?? []);
      return rows.map(publicDocument);
    });
  }

  @Post('ask')
  ask(@Req() request: AuthenticatedRequest, @Body() body: AskDocumentDto) {
    return this.guard(() => this.documents.ask(request.currentUser.id, body.question));
  }

  @Get(':id')
  detail(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    if (!RESOURCE_ID.test(id)) {
      throw new HttpException(
        { code: 'NOT_FOUND', message: 'That document is not available to this account.' },
        HttpStatus.NOT_FOUND,
      );
    }
    return this.guard(async () =>
      publicDocument(await this.documents.details(request.currentUser.id, id)),
    );
  }

  private async guard<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof DocumentFlowError) {
        throw new HttpException(documentError(error.reason), statusFor(error.reason));
      }
      throw error;
    }
  }
}

function publicDocument(row: {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  kind: string;
  status: string;
  error: string | null;
  duplicateOf: string | null;
  extraction: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}) {
  const extraction = asExtraction(row.extraction);
  return {
    id: row.id,
    filename: row.filename,
    contentType: row.contentType,
    byteSize: row.byteSize,
    kind: row.kind,
    status: row.status,
    error: row.error,
    duplicateOf: row.duplicateOf,
    financialYears: extraction.financialYears,
    facts: extraction.facts,
    excerpt: extraction.excerpt,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function asExtraction(value: unknown): {
  financialYears: string[];
  facts: Array<{ label: string; value: string; calculated: boolean; source: { locator: string } }>;
  excerpt: string;
} {
  if (!value || typeof value !== 'object') {
    return { financialYears: [], facts: [], excerpt: '' };
  }
  const record = value as Record<string, unknown>;
  const years = Array.isArray(record.financialYears)
    ? record.financialYears.filter((item): item is string => typeof item === 'string').slice(0, 8)
    : [];
  const facts = Array.isArray(record.facts)
    ? record.facts.flatMap((item) => {
        if (!item || typeof item !== 'object') {
          return [];
        }
        const fact = item as Record<string, unknown>;
        const source =
          fact.source && typeof fact.source === 'object'
            ? (fact.source as Record<string, unknown>)
            : {};
        if (typeof fact.label !== 'string' || typeof fact.value !== 'string') {
          return [];
        }
        return [
          {
            label: fact.label.slice(0, 80),
            value: fact.value.slice(0, 200),
            calculated: fact.calculated === true,
            source: {
              locator:
                typeof source.locator === 'string' ? source.locator.slice(0, 120) : 'document',
            },
          },
        ];
      })
    : [];
  return {
    financialYears: years,
    facts: facts.slice(0, 80),
    excerpt: typeof record.excerpt === 'string' ? record.excerpt.slice(0, 1_200) : '',
  };
}

function documentError(reason: DocumentFlowError['reason']): { code: string; message: string } {
  switch (reason) {
    case 'queue_unavailable':
      return { code: 'DOCUMENT_QUEUE_UNAVAILABLE', message: 'The documents could not be queued.' };
    case 'invalid':
      return { code: 'INVALID_INPUT', message: 'Those files could not be accepted.' };
    default:
      return { code: 'NOT_FOUND', message: 'That document is not available to this account.' };
  }
}

function statusFor(reason: DocumentFlowError['reason']): HttpStatus {
  switch (reason) {
    case 'queue_unavailable':
      return HttpStatus.SERVICE_UNAVAILABLE;
    case 'invalid':
      return HttpStatus.BAD_REQUEST;
    default:
      return HttpStatus.NOT_FOUND;
  }
}
