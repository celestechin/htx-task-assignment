import { Router } from 'express';
import { getSkill, listSkills } from '../services/skillService';
import { idParam } from '../validation';

// read only, skills come from the seed data
export const skillsRouter = Router();

skillsRouter.get('/', async (_req, res) => {
  res.json(await listSkills());
});

skillsRouter.get('/:id', async (req, res) => {
  res.json(await getSkill(idParam.parse(req.params.id)));
});
