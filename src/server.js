import { createApp } from './app.js';
import { config } from '../config/env.js';
import { prisma } from '../config/prisma.js';

async function main() {
  // Mark any reviews left in a non-terminal state (from a previous crash/restart)
  // as FAILED so they are not stuck queued/running forever.
  try {
    const { count } = await prisma.review.updateMany({
      where: { status: { in: ['QUEUED', 'RUNNING'] } },
      data: {
        status: 'FAILED',
        errorMessage: 'Server restarted before the review completed.',
        completedAt: new Date(),
      },
    });
    if (count > 0) {
      console.log(`[startup] Marked ${count} interrupted review(s) as FAILED.`);
    }
  } catch (err) {
    console.warn(`[startup] Could not reconcile interrupted reviews: ${err.message}`);
  }

  const app = createApp();
  app.listen(config.PORT, () => {
    console.log(`PatchPilot API listening on http://localhost:${config.PORT}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

// Graceful shutdown.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log(`\n[shutdown] Received ${signal}, closing.`);
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  });
}