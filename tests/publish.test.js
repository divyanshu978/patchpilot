import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { prisma, resetDb, closeDb } from './helpers/db.js';

// GitHub App is considered configured so the publish path is exercised.
process.env.GITHUB_APP_ID = '123';
process.env.GITHUB_APP_PRIVATE_KEY = 'test-private-key';
process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';

const { publishSummary } = await import('../src/services/review.service.js');

async function seedCompletedReview() {
  const repo = await prisma.repository.create({
    data: { githubRepositoryId: 9001, owner: 'acme', name: 'demo', installationId: 99 },
  });
  const pr = await prisma.pullRequest.create({
    data: {
      repositoryId: repo.id,
      number: 7,
      title: 'Change',
      state: 'open',
      headSha: 'c'.repeat(40),
      baseSha: 'd'.repeat(40),
    },
  });
  const review = await prisma.review.create({
    data: {
      pullRequestId: pr.id,
      headSha: 'c'.repeat(40),
      status: 'COMPLETED',
      summary: 'One critical issue found.',
      completedAt: new Date(),
      findings: {
        create: [
          {
            title: 'AWS access key exposed',
            description: 'A key is committed.',
            severity: 'CRITICAL',
            category: 'SECURITY',
            filePath: 'src/config.js',
            startLine: 3,
            confidence: 0.95,
          },
        ],
      },
    },
  });
  return review;
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

test('publishes the summary and records the timestamp', async () => {
  const review = await seedCompletedReview();

  const result = await publishSummary(review.id, {
    publishReviewSummary: async (args) => {
      assert.equal(args.owner, 'acme');
      assert.equal(args.repo, 'demo');
      assert.equal(args.pullNumber, 7);
      assert.match(args.body, /PatchPilot review/);
      assert.match(args.body, /AWS access key exposed/);
      return { id: 42, htmlUrl: 'https://github.com/acme/demo/pull/7#pullrequestreview-42' };
    },
  });

  assert.equal(result.published, true);
  assert.equal(result.url, 'https://github.com/acme/demo/pull/7#pullrequestreview-42');

  const stored = await prisma.review.findUnique({ where: { id: review.id } });
  assert.ok(stored.summaryPublishedAt);
  assert.equal(stored.summaryPublishError, null);
});

test('records publishing errors separately from review errors', async () => {
  const review = await seedCompletedReview();

  const result = await publishSummary(review.id, {
    publishReviewSummary: async () => {
      throw Object.assign(new Error('Resource not accessible by integration'), { status: 403 });
    },
  });

  assert.equal(result.published, false);
  assert.match(result.error, /GitHub refused the request/);

  const stored = await prisma.review.findUnique({ where: { id: review.id } });
  assert.equal(stored.status, 'COMPLETED', 'review status must remain COMPLETED');
  assert.equal(stored.errorMessage, null, 'review error must stay empty');
  assert.match(stored.summaryPublishError, /GitHub refused the request/);
});

test('refuses to publish a review that is not completed', async () => {
  const repo = await prisma.repository.create({
    data: { githubRepositoryId: 9002, owner: 'acme', name: 'demo2', installationId: 99 },
  });
  const pr = await prisma.pullRequest.create({
    data: {
      repositoryId: repo.id,
      number: 8,
      title: 'Pending',
      headSha: 'e'.repeat(40),
      baseSha: 'f'.repeat(40),
    },
  });
  const review = await prisma.review.create({
    data: { pullRequestId: pr.id, headSha: 'e'.repeat(40), status: 'RUNNING' },
  });

  await assert.rejects(() => publishSummary(review.id), (err) => {
    assert.equal(err.statusCode, 409);
    return true;
  });
});