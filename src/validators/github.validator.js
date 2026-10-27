import { z } from 'zod';

/** GitHub owner/repository names. */
export const repoSchema = z.object({
  owner: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_.-]+$/, 'Invalid GitHub owner name'),
  repo: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_.-]+$/, 'Invalid GitHub repository name'),
});

export const prParamsSchema = repoSchema.extend({
  number: z.coerce.number().int().positive(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30),
});

export const listPullRequestsQuerySchema = z.object({
  state: z.enum(['open', 'closed', 'all']).default('open'),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30),
});