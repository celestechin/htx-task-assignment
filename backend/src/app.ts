import express from 'express';
import { pool } from './db/pool';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { developersRouter } from './routes/developers';
import { skillsRouter } from './routes/skills';
import { tasksRouter } from './routes/tasks';

export const app = express();

app.use(express.json());

// check if API is ready, docker uses this before starting the frontend
app.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
});

// match incoming requests to code handlers
app.use('/api/tasks', tasksRouter);
app.use('/api/developers', developersRouter);
app.use('/api/skills', skillsRouter);

// these two go last so they only run when nothing above handled the request
app.use(notFoundHandler);
app.use(errorHandler);
