import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { prisma, resetDb, closeDb } from './helpers/db.js';

before(async () => {
  await resetDb();
});

after(async () => {
  await closeDb();
});

beforeEach(async () => {
  await resetDb();
});

async function seedGraph() {
  const repo = await prisma.repository.create({
    data: { githubRepositoryId: 4242, owner: 'octo', name: 'demo', installationId: 12 },
  });
  const pullRequest = await prisma.pullRequest.create({
    data: {
      repositoryId: repo.id,
      number: 3,
      title: 'Improve tests',
      state: 'open',
      headSha: 'f'.repeat(40),
      baseSha: 'e'.repeat(40),
    },
  });
  const review = await prisma.review.create({
    data: {
      pullRequestId: pullRequest.id,
      headSha: 'f'.repeat(40),
      status: 'COMPLETED',
      summary: 'Looks fine',
      completedAt: new Date(),
    },
  });
  await prisma.finding.createMany({
    data: [
      {
        reviewId: review.id,
        title: 'Missing null check',
        description: 'A null value would throw.',
        severity: 'HIGH',
        category: 'BUG',
        filePath: 'src/a.js',
        startLine: 10,
        endLine: 12,
        evidence: 'const value = input.value;',
        suggestedFix: 'Guard against null.',
        confidence: 0.8,
      },
      {
        reviewId: review.id,
        title: 'Test gap',
        description: 'No test covers this branch.',
        severity: 'MEDIUM',
        category: 'TEST',
        confidence: 0.6,
      },
    ],
  });
  return { repo, pullRequest, review };
}

test('stores and reads the full review graph', async () => {
  const { review } = await seedGraph();

  const loaded = await prisma.review.findUnique({
    where: { id: review.id },
    include: { findings: true, pullRequest: { include: { repository: true } } },
  });

  assert.equal(loaded.status, 'COMPLETED');
  assert.equal(loaded.findings.length, 2);
  assert.equal(loaded.pullRequest.number, 3);
  assert.equal(loaded.pullRequest.repository.owner, 'octo');

  const finding = loaded.findings.find((f) => f.severity === 'HIGH');
  assert.equal(finding.startLine, 10);
  assert.equal(finding.endLine, 12);
  assert.equal(finding.suggestedFix, 'Guard against null.');
});

test('deleting a review removes its findings', async () => {
  const { review } = await seedGraph();
  await prisma.review.delete({ where: { id: review.id } });
  assert.equal(await prisma.finding.count({ where: { reviewId: review.id } }), 0);
});

test('deleting a repository cascades to pull requests and reviews', async () => {
  const { repo, pullRequest, review } = await seedGraph();
  await prisma.repository.delete({ where: { id: repo.id } });

  assert.equal(await prisma.pullRequest.count({ where: { id: pullRequest.id } }), 0);
  assert.equal(await prisma.review.count({ where: { id: review.id } }), 0);
});

test('enforces unique webhook deliveries', async () => {
  await prisma.webhookEvent.create({ data: { deliveryId: 'abc-123', eventType: 'ping' } });

  await assert.rejects(
    () => prisma.webhookEvent.create({ data: { deliveryId: 'abc-123', eventType: 'ping' } }),
    (err) => {
      assert.equal(err.code, 'P2002');
      return true;
    },
  );
});

test('enforces a unique pull request per repository', async () => {
  const { repo } = await seedGraph();

  await assert.rejects(
    () =>
      prisma.pullRequest.create({
        data: {
          repositoryId: repo.id,
          number: 3,
          title: 'Duplicate',
          headSha: '1'.repeat(40),
          baseSha: '2'.repeat(40),
        },
      }),
    (err) => {
      assert.equal(err.code, 'P2002');
      return true;
    },
  );
});

test('upserts repositories and pull requests without creating duplicates', async () => {
  const { upsertRepository, upsertPullRequest } = await import('../src/services/github.service.js');

  const githubRepo = { id: 777, name: 'demo', owner: { login: 'octo' } };
  const first = await upsertRepository(githubRepo, 12);
  const second = await upsertRepository(githubRepo, 12);
  assert.equal(first.id, second.id);
  assert.equal(await prisma.repository.count(), 1);

  const prData = {
    number: 11,
    title: 'First',
    state: 'open',
    head: { sha: 'a'.repeat(40) },
    base: { sha: 'b'.repeat(40) },
  };
  const pr1 = await upsertPullRequest(first.id, prData);
  const pr2 = await upsertPullRequest(first.id, { ...prData, title: 'Updated' });
  assert.equal(pr1.id, pr2.id);
  assert.equal(pr2.title, 'Updated');
  assert.equal(await prisma.pullRequest.count(), 1);
});