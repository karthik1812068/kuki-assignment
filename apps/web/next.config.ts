import { config as loadDotenv } from 'dotenv';
import type { NextConfig } from 'next';
import path from 'node:path';

loadDotenv({ path: path.resolve(process.cwd(), '../../.env') });

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
  },
};

export default nextConfig;
