import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { pool } from '../src/db/pool';
import { identifySkills } from '../src/services/skillIdentification';

vi.mock('../src/services/skillIdentification', () => ({ identifySkills: vi.fn() }));

const llm = vi.mocked(identifySkills);
let carol: number;
let backend: number;

const names = (task: { skills: { name: string }[] }) => task.skills.map((skill) => skill.name);

beforeAll(async () => {
  const developers = (await request(app).get('/api/developers')).body;
  carol = developers.find((developer: { name: string }) => developer.name === 'Carol').id;
  const skills = (await request(app).get('/api/skills')).body;
  backend = skills.find((skill: { name: string }) => skill.name === 'Backend').id;
});

beforeEach(async () => {
  llm.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await pool.query('TRUNCATE tasks RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

// part 5 end to end, with gemini swapped for a fake so tests are fast and free
describe('creating tasks without skills', () => {
  it('fills in skills from the LLM', async () => {
    llm.mockResolvedValue([['Frontend', 'Backend']]);

    const response = await request(app).post('/api/tasks').send({ title: 'Update my profile' });

    expect(response.status).toBe(201);
    expect(names(response.body)).toEqual(['Backend', 'Frontend']);
    expect(response.body.skillsPending).toBe(false);
    expect(llm).toHaveBeenCalledWith(['Update my profile'], expect.arrayContaining(['Frontend']));
  });

  it('asks about every skill-less task in the tree in one call', async () => {
    llm.mockResolvedValue([['Frontend'], ['Backend']]);

    const response = await request(app)
      .post('/api/tasks')
      .send({
        title: 'Parent',
        subtasks: [
          { title: 'Chosen by the user', skillIds: [backend] },
          { title: 'Child', subtasks: [] },
        ],
      });

    expect(llm).toHaveBeenCalledTimes(1);
    expect(llm.mock.calls[0][0]).toEqual(['Parent', 'Child']);
    expect(names(response.body)).toEqual(['Frontend']);
    expect(names(response.body.subtasks[0])).toEqual(['Backend']);
    expect(names(response.body.subtasks[1])).toEqual(['Backend']);
  });

  it('does not call the LLM when the user chose the skills', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'A task', skillIds: [backend] });

    expect(response.status).toBe(201);
    expect(llm).not.toHaveBeenCalled();
  });

  it('does not call the LLM for a request that is already invalid', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Parent', subtasks: [{ title: 'Child', skillIds: [999] }] });

    expect(response.status).toBe(400);
    expect(llm).not.toHaveBeenCalled();
  });
});

describe('when the LLM fails', () => {
  async function createPendingTask() {
    llm.mockRejectedValueOnce(new Error('LLM is down'));
    const response = await request(app).post('/api/tasks').send({ title: 'A task' });
    expect(response.status).toBe(201);
    return response.body;
  }

  it('still saves the task and marks its skills as pending', async () => {
    const task = await createPendingTask();
    expect(task.skills).toEqual([]);
    expect(task.skillsPending).toBe(true);
  });

  it('only marks the tasks that needed the LLM', async () => {
    llm.mockRejectedValueOnce(new Error('LLM is down'));
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Parent', skillIds: [backend], subtasks: [{ title: 'Child' }] });

    expect(response.body.skillsPending).toBe(false);
    expect(response.body.subtasks[0].skillsPending).toBe(true);
  });

  it('blocks assignment until skills are identified', async () => {
    const task = await createPendingTask();

    const response = await request(app).patch(`/api/tasks/${task.id}`).send({ assigneeId: carol });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('SKILLS_NOT_IDENTIFIED');
  });

  it('still allows status changes', async () => {
    const task = await createPendingTask();
    const response = await request(app).patch(`/api/tasks/${task.id}`).send({ status: 'Done' });
    expect(response.status).toBe(200);
  });

  it('allows assignment after a successful retry', async () => {
    const task = await createPendingTask();
    llm.mockResolvedValueOnce([['Frontend', 'Backend']]);

    const retried = await request(app).post(`/api/tasks/${task.id}/identify-skills`);
    expect(retried.status).toBe(200);
    expect(retried.body.skillsPending).toBe(false);
    expect(names(retried.body)).toEqual(['Backend', 'Frontend']);

    const assigned = await request(app).patch(`/api/tasks/${task.id}`).send({ assigneeId: carol });
    expect(assigned.status).toBe(200);
  });

  it('reports a failed retry and keeps the task pending', async () => {
    const task = await createPendingTask();
    llm.mockRejectedValueOnce(new Error('Still down'));

    const retried = await request(app).post(`/api/tasks/${task.id}/identify-skills`);
    expect(retried.status).toBe(502);
    expect(retried.body.error.code).toBe('SKILL_IDENTIFICATION_FAILED');
    expect((await request(app).get(`/api/tasks/${task.id}`)).body.skillsPending).toBe(true);
  });
});

describe('POST /api/tasks/:id/identify-skills', () => {
  it('leaves a task that already has skills alone', async () => {
    const task = (
      await request(app)
        .post('/api/tasks')
        .send({ title: 'A task', skillIds: [backend] })
    ).body;

    const response = await request(app).post(`/api/tasks/${task.id}/identify-skills`);
    expect(response.status).toBe(200);
    expect(names(response.body)).toEqual(['Backend']);
    expect(llm).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing task', async () => {
    expect((await request(app).post('/api/tasks/999/identify-skills')).status).toBe(404);
  });
});
