export const AGENT_STATES = [
  'CREATED',
  'ANALYZING',
  'PLANNING',
  'WAITING_FOR_APPROVAL',
  'EXECUTING',
  'TESTING',
  'ANALYZING_FAILURE',
  'FIXING',
  'VALIDATING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type AgentState = (typeof AGENT_STATES)[number];

export type DependencyStatus = 'up' | 'down';

export interface DependencyCheck {
  status: DependencyStatus;
  latencyMs: number;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  service: string;
  checks: Record<string, DependencyCheck>;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

/** HttpOnly session cookie. The value is a session id, never a GitHub token. */
export const SESSION_COOKIE_NAME = 'codepilot_session';

export interface CurrentUser {
  id: string;
  githubId: string;
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  scopes: string[];
}

const APP_PATHS = [
  '/dashboard',
  '/documents',
  '/evaluation',
  '/repositories',
  '/tasks',
  '/settings',
] as const;

/** Keep post-login redirects inside the workspace. */
export const REPOSITORY_PERMISSIONS = ['admin', 'maintain', 'write', 'triage', 'read'] as const;
export type RepositoryPermission = (typeof REPOSITORY_PERMISSIONS)[number];

export const REPOSITORY_STATUSES = ['cloning', 'cloned', 'clone_failed'] as const;
export type RepositoryStatus = (typeof REPOSITORY_STATUSES)[number];

export const INDEXING_STATUSES = [
  'not_started',
  'queued',
  'running',
  'completed',
  'failed',
] as const;
export type IndexingStatus = (typeof INDEXING_STATUSES)[number];

/** Hashed local vectors. This build does not call a hosted embedding model. */
export const LOCAL_EMBEDDING_MODEL = 'local-hash-v1';
export const LOCAL_EMBEDDING_DIMENSIONS = 256;

export const DETECTED_LANGUAGES = [
  'CSS',
  'Dockerfile',
  'Go',
  'HTML',
  'JSON',
  'Java',
  'JavaScript',
  'Markdown',
  'Python',
  'Ruby',
  'Rust',
  'SQL',
  'Shell',
  'TOML',
  'TypeScript',
  'YAML',
] as const;

export const DETECTED_FRAMEWORKS = [
  'Actix',
  'Django',
  'Express',
  'Flask',
  'Gin',
  'NestJS',
  'Next.js',
  'React',
  'Spring',
] as const;

export const DETECTED_PACKAGE_MANAGERS = [
  'Bundler',
  'Cargo',
  'Go modules',
  'Gradle',
  'Maven',
  'npm',
  'pip',
  'pnpm',
  'yarn',
] as const;

export const DETECTED_TEST_FRAMEWORKS = [
  'Jest',
  'JUnit',
  'Mocha',
  'Vitest',
  'cargo test',
  'go test',
  'pytest',
] as const;

export interface AvailableRepository {
  githubRepoId: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  language: string | null;
  description: string | null;
  private: boolean;
  htmlUrl: string;
  permission: RepositoryPermission;
}

export interface ImportedRepository extends AvailableRepository {
  id: string;
  status: RepositoryStatus;
  cloneError: string | null;
  indexing: IndexingStatus;
  indexingError: string | null;
  indexTruncated: boolean;
  indexedAt: string | null;
  fileCount: number | null;
  chunkCount: number | null;
  detectedLanguages: string[];
  detectedFrameworks: string[];
  detectedPackageManagers: string[];
  detectedTestFrameworks: string[];
  embeddingModel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IndexJob {
  repositoryId: string;
  ownerId: string;
}

export interface CodeSearchHit {
  path: string;
  symbol: string | null;
  language: string | null;
  startLine: number;
  endLine: number;
  excerpt: string;
  semanticScore: number;
  keywordScore: number;
  symbolScore: number;
}

export interface CodeSearchResponse {
  indexing: IndexingStatus;
  hits: CodeSearchHit[];
}

export function safeAppPath(value: unknown): string {
  if (typeof value !== 'string') {
    return '/dashboard';
  }
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.includes('\0') ||
    value.includes('://')
  ) {
    return '/dashboard';
  }

  const path = value.split('?')[0]?.split('#')[0] ?? '';
  const allowed = APP_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  return allowed ? path : '/dashboard';
}
