import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { prisma, resetDb, closeDb } from './helpers/db.js';
import { startServer, stopServer, waitFor } from './helpers/server.js';

// GitHub App env must exist before src/config/env.js is evaluated.
process.env.GITHUB_APP_ID = '123';
process.env.GITHUB_APP_PRIVATE_KEY = 'test-private-key';
process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
process.env.GITHUB_INSTALLATION_ID = '99';

const { createApp } = await import('../src/app.js');

const WEBHOOK_SECRET = 'test-secret';
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

function signatureFor(body) {
  return 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

async function postWebhook({ event, delivery, payload, signature, omitHeaders = false }) {
  const body = JSON.stringify(payload);
  const headers = omitHeaders
    ? { 'content-type': 'application/json' }
    : {
        'content-type': 'application/json',
        'x-github-event': event,
        'x-github-delivery': delivery,
        'x-hub-signature-256': signature ?? signatureFor(body),
      };

  const response = await fetch(`${baseUrl}/api/webhooks/github`, {
    method: 'POST',
    headers,
    body,
  });

  return { status: response.status, body: await response.json() };
}

test('rejects an invalid signature without storing the delivery', async () => {
  const result = await postWebhook({
    event: 'ping',
    delivery: 'delivery-invalid',
    payload: { zen: 'hello' },
    signature: 'sha256=deadbeef',
  });

  assert.equal(result.status, 401);
  assert.equal(await prisma.webhookEvent.count(), 0);
});

test('rejects requests without GitHub headers', async () => {
  const result = await postWebhook({
    event: 'ping',
    delivery: 'delivery-no-headers',
    payload: { zen: 'hello' },
    omitHeaders: true,
  });
  assert.equal(result.status, 400);
});

test('accepts a valid ping and ignores duplicate deliveries', async () => {
  const payload = { zen: 'Keep it simple.' };

  const first = await postWebhook({ event: 'ping', delivery: 'delivery-1', payload });
  assert.equal(first.status, 202);
  assert.equal(first.body.duplicate, undefined);

  const duplicate = await postWebhook({ event: 'ping', delivery: 'delivery-1', payload });
  assert.equal(duplicate.status, 202);
  assert.equal(duplicate.body.duplicate, true);

  assert.equal(await prisma.webhookEvent.count({ where: { deliveryId: 'delivery-1' } }), 1);
});

test('stores repositories from an installation.created event', async () => {
  const result = await postWebhook({
    event: 'installation',
    delivery: 'delivery-install',
    payload: {
      action: 'created',
      installation: { id: 99, account: { id: 7, login: 'octo' } },
      repositories: [{ id: 555, name: 'demo', full_name: 'octo/demo' }],
    },
  });

  assert.equal(result.status, 202);

  const repo = await waitFor(() =>
    prisma.repository.findUnique({ where: { githubRepositoryId: 555 } }),
  );
  assert.ok(repo, 'repository should be persisted asynchronously');
  assert.equal(repo.owner, 'octo');
  assert.equal(repo.name, 'demo');
  assert.equal(repo.installationId, 99);
});