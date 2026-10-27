import { Router } from 'express';
import { handleWebhook } from '../controllers/webhook.controller.js';

export const webhookRouter = Router();

// Note: raw body is required for signature verification — see app.js where the
// raw-body parsing is wired for this route.
webhookRouter.post('/github', handleWebhook);