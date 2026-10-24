import { loadRepoEnv } from '@codepilot/config';

loadRepoEnv();

if (!process.env.API_PORT?.trim() && process.env.PORT?.trim()) {
  process.env.API_PORT = process.env.PORT;
}
