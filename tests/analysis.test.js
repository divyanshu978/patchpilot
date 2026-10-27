import test from 'node:test';
import assert from 'node:assert/strict';
import {
  runHeuristicAnalysis,
  runTestGapAnalysis,
  deduplicateFindings,
  redact,
} from '../src/services/analysis.service.js';

test('redact hides the middle of a secret', () => {
  assert.equal(redact('AKIAIOSFODNN7EXAMPL1'), 'AKIA…MPL1');
  assert.equal(redact('short'), '***');
});

test('detects AWS keys, eval, TLS disabling and conflict markers', () => {
  const findings = runHeuristicAnalysis([
    { file: 'src/config.js', line: 4, content: 'const key = "AKIAIOSFODNN7EXAMPL1";' },
    { file: 'src/eval.js', line: 2, content: 'eval(userInput);' },
    { file: 'src/http.js', line: 9, content: 'const agent = { rejectUnauthorized: false };' },
    { file: 'src/merge.js', line: 1, content: '<<<<<<< HEAD' },
    { file: '.github/workflows/ci.yml', line: 12, content: '      uses: some/action@main' },
  ]);

  const rules = findings.map((f) => f.ruleId);
  assert.ok(rules.includes('secret-aws-key'));
  assert.ok(rules.includes('danger-eval'));
  assert.ok(rules.includes('danger-tls-disabled'));
  assert.ok(rules.includes('danger-conflict-marker'));
  assert.ok(rules.includes('danger-unpinned-action'));

  const secret = findings.find((f) => f.ruleId === 'secret-aws-key');
  assert.equal(secret.severity, 'CRITICAL');
  assert.equal(secret.filePath, 'src/config.js');
  assert.equal(secret.startLine, 4);
  assert.ok(!secret.evidence.includes('AKIAIOSFODNN7EXAMPL1'), 'evidence must be redacted');
});

test('does not flag placeholder credentials', () => {
  const findings = runHeuristicAnalysis([
    { file: 'src/config.js', line: 1, content: 'const token = "your-token-here";' },
    { file: 'src/config.js', line: 2, content: 'const key = process.env.API_KEY;' },
  ]);
  assert.equal(findings.filter((f) => f.ruleId === 'secret-generic').length, 0);
});

test('detects missing tests when a change has enough logic', () => {
  const findings = runTestGapAnalysis([
    { file: 'src/payments.js', additions: 18, deletions: 2, binary: false },
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].category, 'TEST');
  assert.equal(findings[0].ruleId, 'test-gap-none');
});

test('does not report a test gap when test files changed', () => {
  const findings = runTestGapAnalysis([
    { file: 'src/payments.js', additions: 18, deletions: 2, binary: false },
    { file: 'tests/payments.test.js', additions: 20, deletions: 0, binary: false },
  ]);
  assert.equal(findings.length, 0);
});

test('deduplicate keeps one finding per file/line/rule', () => {
  const base = {
    description: 'x',
    category: 'BUG',
    filePath: 'src/a.js',
    startLine: 10,
    evidence: null,
    suggestedFix: null,
    source: 'heuristic',
  };
  const findings = deduplicateFindings([
    { ...base, title: 'low', severity: 'LOW', confidence: 0.4, ruleId: 'same' },
    { ...base, title: 'high', severity: 'HIGH', confidence: 0.9, ruleId: 'same' },
  ]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'HIGH');
});