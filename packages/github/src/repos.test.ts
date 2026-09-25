import { describe, expect, it } from 'vitest';
import { gitClonePlan, nextGitHubPage, parseGitHubRepository } from './repos';

const repo = {
  id: 42,
  name: 'hello',
  full_name: 'octocat/hello',
  private: true,
  html_url: 'https://github.com/octocat/hello',
  description: 'A sample',
  default_branch: 'main',
  language: 'TypeScript',
  permissions: { admin: false, push: true, pull: true },
};

describe('parseGitHubRepository', () => {
  it('keeps an accessible GitHub repository', () => {
    expect(parseGitHubRepository(repo)?.permission).toBe('write');
    expect(parseGitHubRepository(repo)?.htmlUrl).toBe('https://github.com/octocat/hello');
  });

  it('drops repositories whose page is not on github.com', () => {
    expect(
      parseGitHubRepository({ ...repo, html_url: 'https://evil.example/octocat/hello' }),
    ).toBeNull();
    expect(parseGitHubRepository({ ...repo, full_name: '../hello' })).toBeNull();
  });
});

describe('nextGitHubPage', () => {
  it('follows only the next page on the GitHub API', () => {
    expect(
      nextGitHubPage(
        '<https://api.github.com/user/repos?page=2>; rel="next", <https://evil.example>; rel="last"',
      ),
    ).toBe('https://api.github.com/user/repos?page=2');
    expect(nextGitHubPage('<https://evil.example/user/repos?page=2>; rel="next"')).toBeNull();
  });
});

describe('gitClonePlan', () => {
  it('clones a fixed GitHub URL and keeps the token out of the arguments', () => {
    const plan = gitClonePlan({
      fullName: 'octocat/hello',
      branch: 'main',
      destination: '/tmp/repo',
      token: 'gho_secret_token',
    });

    expect(plan.command).toBe('git');
    expect(plan.args).toContain('https://github.com/octocat/hello.git');
    expect(plan.args.join(' ')).not.toContain('gho_secret_token');
    expect(plan.header).toContain('gho_secret_token');
    expect(() =>
      gitClonePlan({
        fullName: 'octocat/hello',
        branch: '--upload-pack=evil',
        destination: '/tmp/repo',
        token: 'gho_secret_token',
      }),
    ).toThrow();
  });
});
