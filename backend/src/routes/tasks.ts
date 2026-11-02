import { Router } from 'express';
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  retrySkillIdentification,
  updateTask,
} from '../services/taskService';
import { createTaskBody, idParam, updateTaskBody } from '../validation';

export const tasksRouter = Router();

tasksRouter.get('/', async (_req, res) => {
  res.json(await listTasks());
});

tasksRouter.get('/:id', async (req, res) => {
  res.json(await getTask(idParam.parse(req.params.id)));
});

// create a task, can include a whole tree of subtasks
tasksRouter.post('/', async (req, res) => {
  const task = await createTask(createTaskBody.parse(req.body));
  res.status(201).json(task);
});

// change status, assignee, title, skills, priority or due date
tasksRouter.patch('/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  res.json(await updateTask(id, updateTaskBody.parse(req.body)));
});

// 204 = done, nothing to send back
tasksRouter.delete('/:id', async (req, res) => {
  await deleteTask(idParam.parse(req.params.id));
  res.status(204).end();
});

// the retry link for tasks gemini couldn't identify skills for
tasksRouter.post('/:id/identify-skills', async (req, res) => {
  res.json(await retrySkillIdentification(idParam.parse(req.params.id)));
});
