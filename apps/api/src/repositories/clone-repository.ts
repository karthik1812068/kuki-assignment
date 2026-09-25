// Fixed git clone only. The token is passed in the process environment, not as an argument.
// Other repository commands run in the worker as fixed git or docker argument lists.
import { spawn } from 'node:child_process'; // eslint-disable-line no-restricted-imports
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { gitClonePlan } from '@codepilot/github';

export class CloneError extends Error {
  constructor(readonly reason: 'git_missing' | 'timeout' | 'failed') {
    super(reason);
    this.name = 'CloneError';
  }
}

export async function cloneRepository(input: {
  fullName: string;
  branch: string;
  destination: string;
  token: string;
}): Promise<void> {
  const plan = gitClonePlan(input);
  const scratch = path.resolve(path.dirname(input.destination), '..', '..', 'tmp');
  await mkdir(scratch, { recursive: true });
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    TEMP: scratch,
    TMP: scratch,
    TMPDIR: scratch,
  };
  if (input.token.length > 0) {
    env.GIT_CONFIG_COUNT = '1';
    env.GIT_CONFIG_KEY_0 = 'http.extraheader';
    env.GIT_CONFIG_VALUE_0 = plan.header;
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(plan.command, plan.args, {
      windowsHide: true,
      stdio: 'ignore',
      env,
      signal: AbortSignal.timeout(60_000),
    });
    child.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        reject(new CloneError('git_missing'));
        return;
      }
      if (error.name === 'AbortError') {
        reject(new CloneError('timeout'));
        return;
      }
      reject(new CloneError('failed'));
    });
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new CloneError('failed'));
    });
  });
}
