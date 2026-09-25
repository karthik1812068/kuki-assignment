import path from 'node:path';
import { isWorkspacePath } from './proposal';

const IMAGE = /^[a-z0-9][a-z0-9._:/-]{0,120}$/;

export function sandboxArgv(
  tool: string,
  input: Record<string, string | number | boolean>,
): string[] | null {
  if (tool === 'run_tests') {
    return ['npm', 'test'];
  }
  if (tool === 'run_linter') {
    return ['npm', 'run', 'lint'];
  }
  if (tool === 'run_typecheck') {
    return ['npm', 'run', 'typecheck'];
  }
  if (tool === 'run_build') {
    return ['npm', 'run', 'build'];
  }
  if (tool === 'run_test_file' && typeof input.path === 'string' && isWorkspacePath(input.path)) {
    return ['npm', 'test', '--', input.path];
  }
  return null;
}

export function dockerRunArgs(
  image: string,
  workspace: string,
  argv: readonly string[],
): string[] | null {
  if (!IMAGE.test(image) || image.includes('..') || argv.length === 0 || argv.length > 8) {
    return null;
  }
  if (!path.isAbsolute(workspace) || workspace.includes(',') || workspace.includes('"')) {
    return null;
  }
  if (argv.some((arg) => arg.includes('\0') || (arg.startsWith('-') && arg !== '--'))) {
    return null;
  }
  return [
    'docker',
    'run',
    '--rm',
    '--network',
    'none',
    '--cpus',
    '1',
    '--memory',
    '512m',
    '--pids-limit',
    '128',
    '--user',
    '1000:1000',
    '--read-only',
    '--tmpfs',
    '/tmp:rw,nosuid,size=64m',
    '--mount',
    `type=bind,src=${workspace},dst=/workspace`,
    '-w',
    '/workspace',
    '--env',
    'HOME=/tmp',
    '--env',
    'npm_config_cache=/tmp/npm',
    image,
    ...argv,
  ];
}
