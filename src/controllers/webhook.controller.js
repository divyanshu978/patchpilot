import crypto from 'node:crypto';
import { config } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { enqueueReview } from '../services/review.service.js';
import { upsertRepository, upsertPullRequest } from '../services/github.service.js';
import { accepted } from '../utils/response.js';

/**
 * POST /api/webhooks/github
 * Verify the GitHub signature, persist the delivery id (idempotency), then
 * dispatch the event.
 */
export async function handleWebhook(req, res) {
  if (!config.github.isAppConfigured()) {
    return res.status(501).json({ error: 'GitHub webhook is not configured.' });
  }

  const signature = req.headers['x-hub-signature-256'];
  const deliveryId = req.headers['x-github-delivery'];
  const eventType = req.headers['x-github-event'];

  if (!signature || !deliveryId || !eventType) {
    return res.status(400).json({ error: 'Missing GitHub webhook headers.' });
  }
  if (!req.rawBody) {
    return res.status(400).json({ error: 'Missing raw body for signature verification.' });
  }

  if (!verifySignature(req.rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  // Idempotency: the unique deliveryId guarantees a single processing attempt.
  try {
    await prisma.webhookEvent.create({ data: { deliveryId, eventType } });
  } catch (err) {
    if (err.code === 'P2002') {
      return accepted(res, { ok: true, duplicate: true });
    }
    throw err;
  }

  // Acknowledge immediately; processing happens in-process.
  res.status(202).json({ ok: true });

  setImmediate(() => {
    dispatch(eventType, req.body).catch((err) => {
      console.error(`[Webhook] ${eventType} processing failed: ${err.message}`);
    });
  });
}

// ---------------------------------------------------------------------------
// Signature
// ---------------------------------------------------------------------------

/**
 * Constant-time HMAC-SHA256 verification of the exact raw request body.
 */
export function verifySignature(rawBody, signatureHeader) {
  if (!config.github.webhookSecret || typeof signatureHeader !== 'string') return false;

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', config.github.webhookSecret).update(rawBody).digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signatureHeader);

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

// ---------------------------------------------------------------------------
// Event dispatch
// ---------------------------------------------------------------------------

async function dispatch(eventType, payload) {
  if (!payload || typeof payload !== 'object') return;

  switch (eventType) {
    case 'pull_request':
      await handlePullRequestEvent(payload);
      break;
    case 'installation':
      await handleInstallationEvent(payload);
      break;
    case 'installation_repositories':
      await handleInstallationRepositoriesEvent(payload);
      break;
    default:
      // ping and unsupported events are acknowledged without work.
      break;
  }
}

const REVIEWABLE_ACTIONS = new Set(['opened', 'synchronize', 'reopened', 'ready_for_review']);

async function handlePullRequestEvent(payload) {
  const { action, pull_request: pr, installation } = payload;
  if (!pr) return;

  // Persist repository + PR even when the PR is closed, so state stays accurate.
  const dbRepo = await upsertRepository(pr.base.repo, installation?.id);
  await upsertPullRequest(dbRepo.id, pr);

  if (action === 'closed') return;
  if (!REVIEWABLE_ACTIONS.has(action)) return;
  if (pr.draft) return;

  await enqueueReview({
    owner: pr.base.repo.owner.login,
    repo: pr.base.repo.name,
    pullNumber: pr.number,
  });
}

async function handleInstallationEvent(payload) {
  const { action, installation, repositories = [] } = payload;
  if (action !== 'created' && action !== 'new_permissions_accepted') return;

  for (const repo of repositories) {
    await upsertRepository(installationRepo(repo, installation), installation?.id);
  }
}

async function handleInstallationRepositoriesEvent(payload) {
  const { action, installation, repositories_added: added = [] } = payload;
  if (action !== 'added') return;

  for (const repo of added) {
    await upsertRepository(installationRepo(repo, installation), installation?.id);
  }
}

function installationRepo(repo, installation) {
  const ownerLogin = repo.full_name?.split('/')[0] ?? installation?.account?.login ?? 'unknown';
  return {
    id: repo.id,
    name: repo.name,
    owner: { login: ownerLogin },
  };
}