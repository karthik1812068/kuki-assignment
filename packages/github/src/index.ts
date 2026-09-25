export {
  GITHUB_API_EMAILS,
  GITHUB_API_USER,
  GITHUB_AUTHORIZE_URL,
  GITHUB_OAUTH_SCOPES,
  GITHUB_TOKEN_URL,
  GitHubOAuthClient,
  GitHubRequestError,
  buildAuthorizeUrl,
  codeChallenge,
  parseAccessGrant,
  parseGitHubUser,
  primaryVerifiedEmail,
} from './oauth';
export type { GitHubAccessGrant, GitHubOAuthConfig, GitHubProfile } from './oauth';

export {
  GitHubAuthError,
  assertCloneBranch,
  getUserRepository,
  gitClonePlan,
  isRepositoryFullName,
  listUserRepositories,
  nextGitHubPage,
  parseGitHubRepository,
} from './repos';
export type { GitHubRepositoryChoice } from './repos';

export const GITHUB_API_BASE = 'https://api.github.com';

export interface GitHubIdentity {
  githubId: number;
  login: string;
}

export interface GitHubRepositorySummary {
  githubRepoId: number;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
}
