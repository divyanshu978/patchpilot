import { PrismaClient } from '@prisma/client';
import { config } from './env.js';

// Never log query parameters: they can contain repository content or secrets.
export const prisma = new PrismaClient({
  log: config.isProduction ? ['error'] : ['warn', 'error'],
});