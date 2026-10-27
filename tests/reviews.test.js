import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { prisma, resetDb, closeDb } from './helpers/db.js';

const { enqueueReview, getReviewStatus } = await import('../src/services/review.service.js');

const HEAD_SHA = 'a'.repeat(40);
const BASE_SHA = 'b'.repeat(40);

const PATCH = [
  '@@ -1,2 +1,3 @@',
  ' const x = 1;',
  '+const AWS_KEY = "AKIAIOSFODNN7EXAMPL1";',
  ' module.exports = x;',
].join('\n');

const FILES = [
  { filename: 'src/config.js', status: 'modified', additions: 1, deletions: 0, patch: PATCH },
];

function fakePr() {
  return {
    number: 1,
    title: 'Add config',
    body: 'Adds configuration',
    state: 'open',
    draft: false,
    head: { sha: HEAD_SHA },
    base: {
      sha: BASE_SHA,
      repo: {
        id: 1234,
        name: 'demo',
        full_name: 'acme/demo',
        owner: { login: 'acme' },
      },
    },
  };
}

async function seedRepoAndPr() {
  const repo = await prisma.repository.create({
    data: { githubRepositoryId: 1234, owner: 'acme', name: 'demo', installationId: 99 },
  });
  const dbPr = await prisma.pullRequest.create({
    data: {
      repositoryId: repo.id,
      number: 1,
      title: 'Add config',
      state: 'open',
      headSha: HEAD_SHA,
      baseSha: BASE_SHA,
    },
  });
  return { repo, dbPr };
}

function makeDeps(overrides = {}) {
  return {
    fetchPullRequest: async () => ({ pr: fakePr(), files: FILES }),
    fetchFileContent: async () => null,
    upsertRepository: async (githubRepo) =>
      prisma.repository.findUnique({ where: { githubRepositoryId: githubRepo.id } }),
    upsertPullRequest: async (repositoryId, prData) =>
      prisma.pullRequest.findUnique({
        where: { repositoryId_number: { repositoryId, number: prData.number } },
      }),
    publishReviewSummary: async () => {
      throw new Error('publishing should not happen without a configured GitHub App');
    },
    runLLMReview: async () => ({ findings: [], summary: null, used: false }),
    ...overrides,
  };
}

before(async () => {
  await resetDb();
});

after(async () => {
  await closeDb();
});

beforeEach(async () => {
  await resetDb();
});

test('creates, processes and completes a review with stored findings', async () => {
  await seedRepoAndPr();

  const id = await enqueueReview(
    { owner: 'acme', repo: 'demo', pullNumber: 1 },
    { deps: makeDeps(), inline: true },
  );

  const review = await prisma.review.findUnique({
    where: { id },
    include: { findings: true },
  });

  assert.equal(review.status, 'COMPLETED');
  assert.ok(review.completedAt);
  assert.match(review.summary, /PatchPilot reviewed/);
  assert.match(review.summary, /not a guarantee/i);

  const secret = review.findings.find((f) => f.title.includes('AWS'));
  assert.ok(secret, 'the hardcoded key should be reported');
  assert.equal(secret.severity, 'CRITICAL');
  assert.equal(secret.filePath, 'src/config.js');
  assert.equal(secret.startLine, 2);
  assert.ok(!secret.evidence.includes('AKIAIOSFODNN7EXAMPL1'), 'stored evidence is redacted');

  const status = await getReviewStatus(id);
  assert.equal(status.status, 'COMPLETED');
  assert.equal(status.findingCounts.CRITICAL, 1);
});

test('reuses a queued review for the same commit instead of creating a duplicate', async () => {
  const { dbPr } = await seedRepoAndPr();

  const queued = await prisma.review.create({
    data: { pullRequestId: dbPr.id, headSha: HEAD_SHA, status: 'QUEUED' },
  });

  const id = await enqueueReview(
    { owner: 'acme', repo: 'demo', pullNumber: 1 },
    { deps: makeDeps(), inline: true },
  );

  assert.equal(id, queued.id);
  assert.equal(await prisma.review.count(), 1);
  assert.equal((await prisma.review.findUnique({ where: { id } })).status, 'COMPLETED');
});

test('marks the review FAILED when analysis throws', async () => {
  await seedRepoAndPr();

  const id = await enqueueReview(
    { owner: 'acme', repo: 'demo', pullNumber: 1 },
    {
      deps: makeDeps({
        fetchFileContent: async () => {
          throw new Error('GitHub unavailable');
        },
      }),
      inline: true,
    },
  );

  const review = await prisma.review.findUnique({ where: { id } });
  assert.equal(review.status, 'FAILED');
  assert.match(review.errorMessage, /GitHub unavailable/);
  assert.equal(await prisma.finding.count({ where: { reviewId: id } }), 0);
});

test('surfaces GitHub failures from review creation', async () => {
  await assert.rejects(
    () =>
      enqueueReview(
        { owner: 'acme', repo: 'missing', pullNumber: 1 },
        {
          deps: makeDeps({
            fetchPullRequest: async () => {
              throw Object.assign(new Error('Not Found'), { status: 404 });
            },
          }),
          inline: true,
        },
      ),
    (err) => {
      assert.equal(err.statusCode, 404);
      return true;
    },
  );
});