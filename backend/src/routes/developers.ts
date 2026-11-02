import { Router } from 'express';
import { getDeveloper, listDevelopers } from '../services/developerService';
import { idParam } from '../validation';

// read only, developers come from the seed data
export const developersRouter = Router();

developersRouter.get('/', async (_req, res) => {
  res.json(await listDevelopers());
});

developersRouter.get('/:id', async (req, res) => {
  res.json(await getDeveloper(idParam.parse(req.params.id)));
});
