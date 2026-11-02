import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { pool } from '../src/db/pool';
import { identifySkills } from '../src/services/skillIdentification';

vi.mock('../src/services/skillIdentification', () => ({ identifySkills: vi.fn() }));

let frontend: number;
let backend: number;
let alice: number;

const names = (task: { skills: { name: string }[] }) => task.skills.map((skill) => skill.name);

beforeAll(async () => {
  const skills = (await request(app).get('/api/skills')).body;
  frontend = skills.find((skill: { name: string }) => skill.name === 'Frontend').id;
  backend = skills.find((skill: { name: string }) => skill.name === 'Backend').id;
  const developers = (await request(app).get('/api/developers')).body;
  alice = developers.find((developer: { name: string }) => developer.name === 'Alice').id;
});

beforeEach(async () => {
  vi.mocked(identifySkills).mockImplementation(async (titles) => titles.map(() => ['Backend']));
  await pool.query('TRUNCATE tasks RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

async function create(body: object) {
  const response = await request(app).post('/api/tasks').send(body);
  expect(response.status).toBe(201);
  return response.body;
}

const patch = (id: number, body: object) => request(app).patch(`/api/tasks/${id}`).send(body);

// the extras on top of the brief: priority, due dates, sparkle source, edit and delete
describe('priority and due date', () => {
  it('defaults to Medium priority and no due date', async () => {
    const task = await create({ title: 'A task', skillIds: [frontend] });
    expect(task).toMatchObject({ priority: 'Medium', dueDate: null });
  });

  it('saves priority and due date on tasks and subtasks', async () => {
    const task = await create({
      title: 'Parent',
      skillIds: [frontend],
      priority: 'High',
      dueDate: '2026-12-01',
      subtasks: [{ title: 'Child', skillIds: [frontend], priority: 'Low' }],
    });

    expect(task).toMatchObject({ priority: 'High', dueDate: '2026-12-01' });
    expect(task.subtasks[0]).toMatchObject({ priority: 'Low', dueDate: null });
  });

  it('rejects an unknown priority and a badly formatted date', async () => {
    const badPriority = await request(app)
      .post('/api/tasks')
      .send({ title: 'A task', priority: 'Urgent' });
    const badDate = await request(app)
      .post('/api/tasks')
      .send({ title: 'A task', dueDate: '05/11/2026' });

    expect(badPriority.status).toBe(400);
    expect(badDate.status).toBe(400);
  });

  it('changes and clears the due date and changes priority', async () => {
    const task = await create({ title: 'A task', skillIds: [frontend], dueDate: '2026-12-01' });

    const changed = await patch(task.id, { dueDate: '2026-12-24', priority: 'High' });
    expect(changed.body).toMatchObject({ dueDate: '2026-12-24', priority: 'High' });

    const cleared = await patch(task.id, { dueDate: null });
    expect(cleared.body).toMatchObject({ dueDate: null, priority: 'High' });
  });
});

describe('where skills came from', () => {
  it('marks skills chosen by the LLM as ai and skills chosen by the user as user', async () => {
    const task = await create({
      title: 'Parent',
      skillIds: [frontend],
      subtasks: [{ title: 'Child' }],
    });

    expect(task.skillsSource).toBe('user');
    expect(task.subtasks[0].skillsSource).toBe('ai');
  });

  it('switches to user when the user edits LLM-chosen skills', async () => {
    const task = await create({ title: 'A task' });
    expect(task.skillsSource).toBe('ai');

    const edited = await patch(task.id, { skillIds: [frontend] });
    expect(edited.body.skillsSource).toBe('user');
    expect(names(edited.body)).toEqual(['Frontend']);
  });
});

describe('editing a task', () => {
  it('changes the title and replaces the skills', async () => {
    const task = await create({ title: 'Old title', skillIds: [frontend] });

    const edited = await patch(task.id, { title: '  New title  ', skillIds: [frontend, backend] });
    expect(edited.status).toBe(200);
    expect(edited.body.title).toBe('New title');
    expect(names(edited.body)).toEqual(['Backend', 'Frontend']);
  });

  it('refuses skills the current assignee does not have, and changes nothing', async () => {
    const task = await create({ title: 'A task', skillIds: [frontend] });
    await patch(task.id, { assigneeId: alice });

    const edited = await patch(task.id, { title: 'Renamed', skillIds: [backend] });
    expect(edited.status).toBe(422);
    expect(edited.body.error.code).toBe('DEVELOPER_MISSING_SKILLS');

    const unchanged = (await request(app).get(`/api/tasks/${task.id}`)).body;
    expect(unchanged.title).toBe('A task');
    expect(names(unchanged)).toEqual(['Frontend']);
  });

  it('lets skills be set by hand for a task whose skills are pending', async () => {
    vi.mocked(identifySkills).mockRejectedValueOnce(new Error('LLM is down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const task = await create({ title: 'A task' });
    expect(task.skillsPending).toBe(true);

    const edited = await patch(task.id, { skillIds: [frontend] });
    expect(edited.body.skillsPending).toBe(false);
    expect((await patch(task.id, { assigneeId: alice })).status).toBe(200);
  });

  it('rejects an empty skill list and a blank title', async () => {
    const task = await create({ title: 'A task', skillIds: [frontend] });

    expect((await patch(task.id, { skillIds: [] })).status).toBe(400);
    expect((await patch(task.id, { title: '   ' })).status).toBe(400);
    expect((await patch(task.id, { skillIds: [999] })).status).toBe(400);
  });
});

describe('deleting a task', () => {
  it('deletes a task with all its subtasks', async () => {
    const task = await create({
      title: 'Parent',
      skillIds: [frontend],
      subtasks: [{ title: 'Child', skillIds: [frontend], subtasks: [{ title: 'Grandchild' }] }],
    });

    const response = await request(app).delete(`/api/tasks/${task.id}`);
    expect(response.status).toBe(204);

    const count = await pool.query('SELECT count(*)::int AS count FROM tasks');
    expect(count.rows[0].count).toBe(0);
  });

  it('deletes only the chosen subtask', async () => {
    const task = await create({
      title: 'Parent',
      skillIds: [frontend],
      subtasks: [
        { title: 'Child 1', skillIds: [frontend] },
        { title: 'Child 2', skillIds: [frontend] },
      ],
    });

    await request(app).delete(`/api/tasks/${task.subtasks[0].id}`);
    const parent = (await request(app).get(`/api/tasks/${task.id}`)).body;
    expect(parent.subtasks.map((subtask: { title: string }) => subtask.title)).toEqual(['Child 2']);
  });

  it('returns 404 for a missing task', async () => {
    expect((await request(app).delete('/api/tasks/999')).status).toBe(404);
  });
});
