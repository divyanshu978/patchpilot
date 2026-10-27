import test from 'node:test';
import assert from 'node:assert/strict';

// Configure the LLM before the service (and its env config) is loaded.
process.env.NODE_ENV = 'test';
process.env.LLM_API_KEY = 'test-key';
process.env.LLM_BASE_URL = 'https://llm.test/v1';
process.env.LLM_MODEL = 'test-model';

const { runLLMReview } = await import('../src/services/ai.service.js');

const originalFetch = globalThis.fetch;

function mockFetch(payload, { status = 200 } = {}) {
  const captured = [];
  globalThis.fetch = async (url, init) => {
    captured.push({ url, init, body: JSON.parse(init.body) });
    const content = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return new Response(
      JSON.stringify({ choices: [{ message: { content } }] }),
      { status, headers: { 'content-type': 'application/json' } },
    );
  };
  return captured;
}

test.after(() => {
  globalThis.fetch = originalFetch;
});

const pr = { title: 'Fix database access', body: 'Adds query helper' };
const secretDiff = `### src/db.js
\`\`\`diff
+const key = "AKIAIOSFODNN7EXAMPL1";
+db.query("SELECT * FROM users WHERE id = " + userId);
\`\`\``;

test('keeps valid findings, drops unknown files, normalises confidence and redacts secrets', async () => {
  const captured = mockFetch({
    summary: 'There is a SQL injection risk.',
    overallRisk: 'HIGH',
    findings: [
      {
        title: 'SQL injection in query helper',
        description: 'User input is concatenated into a SQL query.',
        severity: 'HIGH',
        category: 'SECURITY',
        filePath: 'src/db.js',
        startLine: 2,
        evidence: 'db.query(...)',
        suggestedFix: 'Use a parameterized query.',
        confidence: 90,
      },
      {
        title: 'Ghost finding',
        description: 'This file is not part of the diff.',
        severity: 'LOW',
        category: 'BUG',
        filePath: 'src/elsewhere.js',
        startLine: 1,
        evidence: 'something changed',
      },
      {
        title: 'Wrong line reference',
        description: 'Line 999 was not added by this diff.',
        severity: 'MEDIUM',
        category: 'BUG',
        filePath: 'src/db.js',
        startLine: 999,
        evidence: 'db.query(...)',
      },
    ],
  });

  const result = await runLLMReview(
    pr,
    secretDiff,
    new Set(['src/db.js']),
    new Map([['src/db.js', new Set([1, 2])]]),
  );

  assert.equal(result.used, true);
  assert.equal(result.summary, 'There is a SQL injection risk.');
  assert.equal(result.findings.length, 2);

  const sql = result.findings.find((f) => f.title.includes('SQL'));
  assert.equal(sql.confidence, 0.9, '100-scale confidence is normalised');
  assert.equal(sql.filePath, 'src/db.js');
  assert.equal(sql.startLine, 2);

  const wrong = result.findings.find((f) => f.title.includes('Wrong line'));
  assert.equal(wrong.startLine, null, 'line outside the diff is removed');

  assert.equal(captured.length, 1);
  const userPrompt = captured[0].body.messages[1].content;
  assert.ok(!userPrompt.includes('AKIAIOSFODNN7EXAMPL1'), 'secret must be redacted before sending');
  assert.ok(userPrompt.includes('[REDACTED:aws-key]'));
  assert.equal(captured[0].init.headers.Authorization, 'Bearer test-key');
});

test('rejects responses that are not valid JSON', async () => {
  mockFetch('this is not json');
  const result = await runLLMReview(pr, secretDiff, new Set(['src/db.js']), new Map());
  assert.equal(result.used, false);
  assert.equal(result.findings.length, 0);
});

test('normalises provider-specific enum and confidence formats', async () => {
  mockFetch({
    summary: 'Provider returned relaxed casing.',
    findings: [
      {
        title: 'SQL injection in query helper',
        description: 'User input is concatenated into a SQL query.',
        severity: 'Critical',
        category: 'Security',
        filePath: 'src/db.js',
        startLine: '2',
        endLine: '2',
        evidence: 'db.query(...)',
        confidence: 'HIGH',
      },
    ],
  });

  const result = await runLLMReview(
    pr,
    secretDiff,
    new Set(['src/db.js']),
    new Map([['src/db.js', new Set([1, 2])]]),
  );

  assert.equal(result.used, true);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].severity, 'CRITICAL');
  assert.equal(result.findings[0].category, 'SECURITY');
  assert.equal(result.findings[0].confidence, 0.9);
  assert.equal(result.findings[0].startLine, 2);
});

test('drops findings that fail schema validation but keeps usable output', async () => {
  mockFetch({
    findings: [
      {
        title: 'Bad severity',
        description: 'Severity is not one of the allowed values.',
        severity: 'SUPER_HIGH',
        category: 'SECURITY',
        filePath: 'src/db.js',
        evidence: 'db.query(...)',
      },
    ],
  });
  const result = await runLLMReview(pr, secretDiff, new Set(['src/db.js']), new Map());
  assert.equal(result.used, true);
  assert.equal(result.findings.length, 0);
});

test('returns no findings when the API is unavailable', async () => {
  globalThis.fetch = async () => new Response('upstream error', { status: 502 });
  const result = await runLLMReview(pr, secretDiff, new Set(['src/db.js']), new Map());
  assert.equal(result.used, false);
  assert.equal(result.findings.length, 0);
});