import { z } from 'zod';

export const createReviewSchema = z.object({
  owner: z.string().min(1).max(100),
  repo: z.string().min(1).max(100),
  pullNumber: z.number().int().positive(),
});

export const listReviewsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']).optional(),
  repositoryId: z.string().uuid().optional(),
});

export const listPRsSchema = z.object({
  state: z.enum(['open', 'closed', 'all']).default('open'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30),
});

export const getPRSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  number: z.coerce.number().int().positive(),
});