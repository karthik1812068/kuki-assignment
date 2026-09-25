// Fixed git and docker argument lists only. Nothing from repository text is passed to a shell.
import { spawn } from 'node:child_process'; // eslint-disable-line no-restricted-imports

export interface ArgvResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  missing: boolean;
}

export async function runArgv(
  command: 'git' | 'docker',
  args: readonly string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number },
): Promise<ArgvResult> {
  return await new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let missing = false;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      shell: false,
      signal: AbortSignal.timeout(options.timeoutMs),
    });
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout = `${stdout}${chunk}`.slice(0, 8_000);
    });
    child.stderr?.on('data', (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(0, 8_000);
    });
    child.once('error', (error: NodeJS.ErrnoException) => {
      missing = error.code === 'ENOENT';
      timedOut = error.name === 'AbortError';
      resolve({ code: null, stdout, stderr, timedOut, missing });
    });
    child.once('exit', (code) => {
      resolve({ code, stdout, stderr, timedOut, missing });
    });
  });
}

export function processPathEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  if (process.env.PATH) {
    env.PATH = process.env.PATH;
  }
  if (process.env.SystemRoot) {
    env.SystemRoot = process.env.SystemRoot;
  }
  return env;
}
