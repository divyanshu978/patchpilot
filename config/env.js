import dotenv from 'dotenv';
import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env (skip when running tests with mocks)
if (existsSync('.env')) {
  dotenv.config();
  dotenv.config({ path: '.env.local', override: true });
}

// An empty string means "unset" — coerce to undefined before parsing.
const optionalInt = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().default('postgresql://patchpilot:patchpilot@localhost:5432/patchpilot'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY_PATH: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_INSTALLATION_ID: optionalInt,
  GITHUB_APP_SLUG: z.string().default('patchpilot'),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  LLM_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  LLM_MAX_DIFF_CHARS: z.coerce.number().int().positive().default(120_000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten());
  process.exit(1);
}

const raw = parsed.data;

/** Normalise the GitHub private key: replace literal \n with actual newlines. */
function normalisePrivateKey(rawKey) {
  let key = rawKey;
  // Strip surrounding quotes if present (dotenv sometimes leaves them).
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, '\n');
}

function loadPrivateKey(rawKey, keyPath) {
  if (keyPath) {
    const resolvedPath = resolve(keyPath);
    try {
      return readFileSync(resolvedPath, 'utf8').trim();
    } catch (error) {
      throw new Error(
        `Could not read GITHUB_APP_PRIVATE_KEY_PATH (${resolvedPath}): ${error.message}`,
        { cause: error },
      );
    }
  }

  return rawKey ? normalisePrivateKey(rawKey) : undefined;
}

export const config = Object.freeze({
  NODE_ENV: raw.NODE_ENV,
  PORT: raw.PORT,
  DATABASE_URL: raw.DATABASE_URL,
  FRONTEND_URL: raw.FRONTEND_URL,
  github: {
    appId: raw.GITHUB_APP_ID,
    privateKey: loadPrivateKey(raw.GITHUB_APP_PRIVATE_KEY, raw.GITHUB_APP_PRIVATE_KEY_PATH),
    webhookSecret: raw.GITHUB_WEBHOOK_SECRET,
    installationId: raw.GITHUB_INSTALLATION_ID,
    appSlug: raw.GITHUB_APP_SLUG,
    /** Is the GitHub App fully configured? */
    isAppConfigured() {
      return Boolean(this.appId && this.privateKey && this.webhookSecret);
    },
  },
  llm: {
    apiKey: raw.LLM_API_KEY,
    model: raw.LLM_MODEL,
    baseUrl: raw.LLM_BASE_URL,
    timeoutMs: raw.LLM_TIMEOUT_MS,
    maxDiffChars: raw.LLM_MAX_DIFF_CHARS,
    /** Is LLM review available? */
    isConfigured() {
      return Boolean(this.apiKey);
    },
  },
  isProduction: raw.NODE_ENV === 'production',
});