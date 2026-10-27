import { Router } from 'express';
import {
  createReview,
  getReview,
  listReviews,
  getFindings,
  getReviewStatus,
  publishReview,
} from '../controllers/review.controller.js';

export const reviewRouter = Router();

reviewRouter.post('/', createReview);
reviewRouter.get('/', listReviews);
reviewRouter.post('/:id/publish', publishReview);
reviewRouter.get('/:id', getReview);
reviewRouter.get('/:id/findings', getFindings);
reviewRouter.get('/:id/status', getReviewStatus);