import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { pool } from '../src/db/pool';

vi.mock('../src/services/skillIdentification', () => ({ identifySkills: vi.fn() }));

let frontend: number;
let backend: number;
let alice: number;
let bob: number;
let carol: number;

beforeAll(async () => {
  const skills = (await request(app).get('/api/skills')).body;
  frontend = skills.find((skill: { name: string }) => skill.name === 'Frontend').id;
  backend = skills.find((skill: { name: string }) => skill.name === 'Backend').id;

  const developers = (await request(app).get('/api/developers')).body;
  const idOf = (name: string) =>
    developers.find((developer: { name: string }) => developer.name === name).id;
  alice = idOf('Alice');
  bob = idOf('Bob');
  carol = idOf('Carol');
});

beforeEach(async () => {
  await pool.query('TRUNCATE tasks RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

async function createTask(skillIds: number[], title = 'A task') {
  const response = await request(app).post('/api/tasks').send({ title, skillIds });
  expect(response.status).toBe(201);
  return response.body;
}

// parts 2 and 3: the basic endpoints and the skill matching rule
// runs against a real postgres since a lot of the logic is in the sql
describe('POST /api/tasks', () => {
  it('creates an unassigned To-do task with its skills', async () => {
    const task = await createTask([frontend, backend], 'Build a page');

    expect(task).toMatchObject({ title: 'Build a page', status: 'To-do', assignee: null });
    expect(task.skills.map((skill: { name: string }) => skill.name)).toEqual([
      'Backend',
      'Frontend',
    ]);
  });

  it('treats a repeated skill as one skill', async () => {
    const task = await createTask([frontend, frontend]);
    expect(task.skills).toHaveLength(1);
  });

  it('rejects a blank title', async () => {
    const response = await request(app).post('/api/tasks').send({ title: '   ' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a skill that does not exist and saves nothing', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'A task', skillIds: [999] });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('UNKNOWN_SKILL');
    expect((await request(app).get('/api/tasks')).body).toHaveLength(0);
  });

  it('rejects malformed JSON with a client error', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send('{ not json');
    expect(response.status).toBe(400);
  });
});

describe('GET /api/tasks', () => {
  it('lists tasks and reads one by id', async () => {
    const task = await createTask([backend]);

    const list = await request(app).get('/api/tasks');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);

    const single = await request(app).get(`/api/tasks/${task.id}`);
    expect(single.status).toBe(200);
    expect(single.body.id).toBe(task.id);
  });

  it('returns 404 for a missing task and 400 for a bad id', async () => {
    expect((await request(app).get('/api/tasks/999')).status).toBe(404);
    expect((await request(app).get('/api/tasks/abc')).status).toBe(400);
    expect((await request(app).get('/api/tasks/99999999999')).status).toBe(400);
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('assigns a developer who has the required skill', async () => {
    const task = await createTask([frontend]);
    const response = await request(app).patch(`/api/tasks/${task.id}`).send({ assigneeId: alice });

    expect(response.status).toBe(200);
    expect(response.body.assignee).toEqual({ id: alice, name: 'Alice' });
  });

  it('rejects a developer who lacks the required skill', async () => {
    const task = await createTask([frontend]);
    const response = await request(app).patch(`/api/tasks/${task.id}`).send({ assigneeId: bob });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('DEVELOPER_MISSING_SKILLS');
    expect(response.body.error.message).toContain('Frontend');
    expect((await request(app).get(`/api/tasks/${task.id}`)).body.assignee).toBeNull();
  });

  it('requires every skill, not just one of them', async () => {
    const task = await createTask([frontend, backend]);
    const url = `/api/tasks/${task.id}`;

    expect((await request(app).patch(url).send({ assigneeId: alice })).status).toBe(422);
    expect((await request(app).patch(url).send({ assigneeId: bob })).status).toBe(422);
    expect((await request(app).patch(url).send({ assigneeId: carol })).status).toBe(200);
  });

  it('rejects a developer who does not exist', async () => {
    const task = await createTask([frontend]);
    const response = await request(app).patch(`/api/tasks/${task.id}`).send({ assigneeId: 999 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('UNKNOWN_DEVELOPER');
  });

  it('unassigns with null and leaves the assignee alone when it is omitted', async () => {
    const task = await createTask([frontend]);
    const url = `/api/tasks/${task.id}`;
    await request(app).patch(url).send({ assigneeId: alice });

    const statusOnly = await request(app).patch(url).send({ status: 'In Progress' });
    expect(statusOnly.body).toMatchObject({
      status: 'In Progress',
      assignee: { id: alice, name: 'Alice' },
    });

    const unassigned = await request(app).patch(url).send({ assigneeId: null });
    expect(unassigned.body).toMatchObject({ status: 'In Progress', assignee: null });
  });

  it('rejects a status change on an unassigned task', async () => {
    const task = await createTask([frontend]);
    const response = await request(app).patch(`/api/tasks/${task.id}`).send({ status: 'Done' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('TASK_NOT_ASSIGNED');
    expect((await request(app).get(`/api/tasks/${task.id}`)).body.status).toBe('To-do');
  });

  it('allows assigning and changing status in one request', async () => {
    const task = await createTask([frontend]);
    const response = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .send({ assigneeId: alice, status: 'In Progress' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'In Progress', assignee: { id: alice } });
  });

  it('rejects unassigning and changing status in one request', async () => {
    const task = await createTask([frontend]);
    const url = `/api/tasks/${task.id}`;
    await request(app).patch(url).send({ assigneeId: alice });

    const response = await request(app).patch(url).send({ assigneeId: null, status: 'Done' });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('TASK_NOT_ASSIGNED');
  });

  it('rejects an unknown status, an empty body and unknown fields', async () => {
    const task = await createTask([frontend]);
    const url = `/api/tasks/${task.id}`;

    expect((await request(app).patch(url).send({ status: 'Blocked' })).status).toBe(400);
    expect((await request(app).patch(url).send({})).status).toBe(400);
    expect((await request(app).patch(url).send({ title: 'New' })).status).toBe(400);
  });

  it('returns 404 for a missing task', async () => {
    const response = await request(app).patch('/api/tasks/999').send({ status: 'Done' });
    expect(response.status).toBe(404);
  });
});

describe('developers and skills', () => {
  it('lists developers with their skills and assigned tasks', async () => {
    const task = await createTask([frontend, backend], 'Full stack work');
    await request(app).patch(`/api/tasks/${task.id}`).send({ assigneeId: carol });

    const response = await request(app).get(`/api/developers/${carol}`);
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Carol');
    expect(response.body.skills).toHaveLength(2);
    expect(response.body.tasks).toEqual([
      { id: task.id, title: 'Full stack work', status: 'To-do' },
    ]);

    expect((await request(app).get('/api/developers')).body).toHaveLength(4);
  });

  it('reads a skill with the developers who have it', async () => {
    const response = await request(app).get(`/api/skills/${frontend}`);
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Frontend');
    expect(response.body.developers.map((developer: { name: string }) => developer.name)).toEqual([
      'Alice',
      'Carol',
    ]);
  });

  it('returns 404 for a missing developer or skill', async () => {
    expect((await request(app).get('/api/developers/999')).status).toBe(404);
    expect((await request(app).get('/api/skills/999')).status).toBe(404);
  });
});
