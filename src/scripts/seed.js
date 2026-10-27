import { prisma } from '../../config/prisma.js';

/**
 * Insert a deterministic demo review so the API (and the future frontend) has
 * something to show without a GitHub App. Safe to run repeatedly.
 */
const DEMO_REVIEW_ID = '00000000-0000-4000-8000-000000000001';

async function main() {
  const repository = await prisma.repository.upsert({
    where: { githubRepositoryId: 1001 },
    update: { owner: 'acme', name: 'demo' },
    create: {
      githubRepositoryId: 1001,
      owner: 'acme',
      name: 'demo',
      installationId: 0,
    },
  });

  const pullRequest = await prisma.pullRequest.upsert({
    where: { repositoryId_number: { repositoryId: repository.id, number: 42 } },
    update: {
      title: 'Add webhook signature verification',
      state: 'open',
      headSha: 'demo-head-sha',
      baseSha: 'demo-base-sha',
    },
    create: {
      repositoryId: repository.id,
      number: 42,
      title: 'Add webhook signature verification',
      state: 'open',
      headSha: 'demo-head-sha',
      baseSha: 'demo-base-sha',
    },
  });

  const review = await prisma.review.upsert({
    where: { id: DEMO_REVIEW_ID },
    update: {
      status: 'COMPLETED',
      summary:
        'PatchPilot reviewed "Add webhook signature verification" and found 4 issue(s): 1 critical, 1 high, 1 medium, 1 low. This automated review is not a guarantee that the code is bug-free or secure.',
      errorMessage: null,
      completedAt: new Date(),
    },
    create: {
      id: DEMO_REVIEW_ID,
      pullRequestId: pullRequest.id,
      headSha: 'demo-head-sha',
      status: 'COMPLETED',
      summary:
        'PatchPilot reviewed "Add webhook signature verification" and found 4 issue(s): 1 critical, 1 high, 1 medium, 1 low. This automated review is not a guarantee that the code is bug-free or secure.',
      completedAt: new Date(),
    },
  });

  await prisma.finding.deleteMany({ where: { reviewId: review.id } });

  await prisma.finding.createMany({
    data: [
      {
        reviewId: review.id,
        title: 'AWS access key exposed',
        description:
          'A hardcoded AWS access key was found in the changed lines. Anyone with access to the repository history can use it.',
        severity: 'CRITICAL',
        category: 'SECURITY',
        filePath: 'src/config/aws.js',
        startLine: 12,
        endLine: 12,
        evidence: 'const accessKeyId = "AKIA…MPL1";',
        suggestedFix:
          'Remove the key from source control, rotate it in AWS, and load it from an environment variable or a secrets manager.',
        confidence: 0.95,
      },
      {
        reviewId: review.id,
        title: 'Potential SQL injection via string concatenation',
        description:
          'User input is interpolated directly into a SQL query, allowing an attacker to alter the query.',
        severity: 'HIGH',
        category: 'SECURITY',
        filePath: 'src/db/users.js',
        startLine: 27,
        endLine: 27,
        evidence: 'db.query(`SELECT * FROM users WHERE id = ${req.params.id}`);',
        suggestedFix: 'Use a parameterized query: db.query("SELECT * FROM users WHERE id = $1", [id]).',
        confidence: 0.9,
      },
      {
        reviewId: review.id,
        title: 'No tests added with this change',
        description:
          'This PR changes two source files with no test files added or modified, including signature verification logic.',
        severity: 'MEDIUM',
        category: 'TEST',
        evidence: 'src/config/aws.js, src/db/users.js',
        suggestedFix:
          'Add tests covering a valid signature, an invalid signature, and a missing header.',
        confidence: 0.7,
      },
      {
        reviewId: review.id,
        title: 'debugger statement left in code',
        description: 'A debugger statement was added and would pause execution if devtools are open.',
        severity: 'LOW',
        category: 'BUG',
        filePath: 'src/webhooks/verify.js',
        startLine: 41,
        endLine: 41,
        evidence: 'debugger;',
        suggestedFix: 'Remove the debugger statement before merging.',
        confidence: 0.85,
      },
    ],
  });

  console.log('Demo data ready:');
  console.log(`  repository: ${repository.owner}/${repository.name} (${repository.id})`);
  console.log(`  pull request: #${pullRequest.number} (${pullRequest.id})`);
  console.log(`  review: ${review.id}`);
  console.log(`  try: GET http://localhost:${process.env.PORT ?? 4000}/api/reviews/${review.id}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });