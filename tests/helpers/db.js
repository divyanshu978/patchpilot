import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

// This module MUST be imported before any src module: it configures env and the
// test database schema.
const baseUrl =
  process.env.DATABASE_URL ?? 'postgresql://patchpilot:patchpilot@localhost:5434/patchpilot';

const url = new URL(baseUrl);
url.searchParams.set('schema', 'patchpilot_test');

process.env.DATABASE_URL = url.toString();
process.env.NODE_ENV = 'test';
process.env.LLM_API_KEY = '';
process.env.GITHUB_APP_ID = '';
process.env.GITHUB_APP_PRIVATE_KEY = '';
process.env.GITHUB_WEBHOOK_SECRET = '';
process.env.GITHUB_INSTALLATION_ID = '';

// Create/update the isolated test schema (Prisma creates the schema itself).
const prismaCli = fileURLToPath(new URL('../../node_modules/prisma/build/index.js', import.meta.url));
execFileSync(
  process.execPath,
  [prismaCli, 'db', 'push', '--skip-generate', '--accept-data-loss'],
  { env: process.env, stdio: 'ignore' },
);

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Finding", "Review", "PullRequest", "Repository", "WebhookEvent" RESTART IDENTITY CASCADE',
  );
}

export async function closeDb() {
  await prisma.$disconnect();
}

export const TEST_SCHEMA = 'patchpilot_test';
export const BASE_URL = baseUrl;