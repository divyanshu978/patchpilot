import { Router } from 'express';
import {
  install,
  listRepositories,
  listPullRequests,
  getPullRequest,
} from '../controllers/github.controller.js';

export const githubRouter = Router();

githubRouter.get('/install', install);
githubRouter.get('/repositories', listRepositories);
githubRouter.get('/repositories/:owner/:repo/pulls', listPullRequests);
githubRouter.get('/repositories/:owner/:repo/pulls/:number', getPullRequest);