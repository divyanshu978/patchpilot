import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';

import { prisma, resetDb, closeDb } from './helpers/db.js';
import { startServer, stopServer } from './helpers/server.js';

const { createApp } = await import('../src/app.js');

let server;
let baseUrl;

before(async () => {
  await resetDb();
  ({ server, baseUrl } = await startServer(createApp()));
});

after(async () => {
  await stopServer(server);
  await closeDb();
});

test('GET /health responds', async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'ok');
});

test('GET /api/reviews returns a paginated list', async () => {
  const response = await fetch(`${baseUrl}/api/reviews?limit=5&offset=0`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(Array.isArray(body.data));
  assert.equal(body.limit, 5);
  assert.equal(body.offset, 0);
  assert.equal(typeof body.total, 'number');
});

test('GET /api/reviews rejects invalid pagination', async () => {
  const response = await fetch(`${baseUrl}/api/reviews?limit=1000`);
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.ok(body.error);
});

test('GET /api/reviews/:id returns 404 for an unknown review', async () => {
  const response = await fetch(`${baseUrl}/api/reviews/00000000-0000-4000-8000-000000000000`);
  assert.equal(response.status, 404);
});

test('GET /api/reviews/:id/status returns 404 for an unknown review', async () => {
  const response = await fetch(
    `${baseUrl}/api/reviews/00000000-0000-4000-8000-000000000000/status`,
  );
  assert.equal(response.status, 404);
});

test('POST /api/reviews validates the request body', async () => {
  const response = await fetch(`${baseUrl}/api/reviews`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ owner: 'acme' }),
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.ok(body.error.repo);
  assert.ok(body.error.pullNumber);
});

test('POST /api/reviews reports GitHub failures without leaking internals', async () => {
  const response = await fetch(`${baseUrl}/api/reviews`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ owner: 'acme', repo: 'demo', pullNumber: 1 }),
  });

  assert.ok(response.status >= 400, 'should not succeed without GitHub credentials');
  const body = await response.json();
  assert.ok(typeof body.error === 'string');
  assert.equal(body.stack, undefined);
  assert.ok(!body.error.includes('BEGIN RSA PRIVATE KEY'));
});

test('GET /api/github/repositories reports a configuration problem', async () => {
  const response = await fetch(`${baseUrl}/api/github/repositories`);
  assert.ok(response.status === 400 || response.status === 500);
  const body = await response.json();
  assert.ok(typeof body.error === 'string');
});

test('unknown routes return a JSON 404', async () => {
  const response = await fetch(`${baseUrl}/does-not-exist`);
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.error, 'Not found');
});

test('POST /api/reviews/:id/publish returns 404 for an unknown review', async () => {
  const response = await fetch(
    `${baseUrl}/api/reviews/00000000-0000-4000-8000-000000000000/publish`,
    { method: 'POST' },
  );
  assert.equal(response.status, 404);
});

test('database is untouched by failed requests', async () => {
  assert.equal(await prisma.review.count(), 0);
});