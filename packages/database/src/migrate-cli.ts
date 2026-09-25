import { errorMessage } from '@codepilot/logger';
import { loadFoundationEnv } from '@codepilot/config';
import { runMigrations } from './migrate';

async function main(): Promise<void> {
  const env = loadFoundationEnv();
  await runMigrations(env.DATABASE_URL);
  process.stdout.write('Migrations applied.\n');
}

main().catch((error: unknown) => {
  process.stderr.write(`${errorMessage(error)}\n`);
  process.exit(1);
});
