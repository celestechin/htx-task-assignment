import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { pool } from '../src/db/pool';
import { identifySkills } from '../src/services/skillIdentification';

vi.mock('../src/services/skillIdentification', () => ({ identifySkills: vi.fn() }));

beforeEach(async () => {
  vi.mocked(identifySkills).mockImplementation(async (titles) => titles.map(() => ['Frontend']));
  await pool.query('TRUNCATE tasks RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});

// status changes need an assignee, carol has every skill so she can take any task
async function assignEveryTaskToCarol() {
  await pool.query(`UPDATE tasks SET assignee_id = (SELECT id FROM developers WHERE name = 'Carol')`);
}

async function createTree() {
  const response = await request(app)
    .post('/api/tasks')
    .send({
      title: 'Parent',
      subtasks: [
        { title: 'Child 1', subtasks: [{ title: 'Grandchild' }] },
        { title: 'Child 2' },
      ],
    });
  expect(response.status).toBe(201);
  await assignEveryTaskToCarol();

  const parent = response.body;
  const child1 = parent.subtasks[0];
  return { parent, child1, child2: parent.subtasks[1], grandchild: child1.subtasks[0] };
}

const setStatus = (id: number, status: string) =>
  request(app).patch(`/api/tasks/${id}`).send({ status });

function nestedTask(levels: number): object {
  return {
    title: `Level ${levels}`,
    subtasks: levels > 1 ? [nestedTask(levels - 1)] : [],
  };
}

// part 4: nested subtasks and the done rule
describe('creating subtasks', () => {
  it('saves a nested tree and returns it in order', async () => {
    const { parent, child1, child2, grandchild } = await createTree();

    expect(parent.parentId).toBeNull();
    expect(child1).toMatchObject({ title: 'Child 1', parentId: parent.id, status: 'To-do' });
    expect(child2).toMatchObject({ title: 'Child 2', parentId: parent.id });
    expect(grandchild).toMatchObject({ title: 'Grandchild', parentId: child1.id });
  });

  it('gives each subtask its own skills, assignee and status', async () => {
    const skills = (await request(app).get('/api/skills')).body;
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Parent', subtasks: [{ title: 'Child', skillIds: [skills[1].id] }] });
    const child = response.body.subtasks[0];

    expect(child.skills).toEqual([{ id: skills[1].id, name: skills[1].name }]);

    const developers = (await request(app).get('/api/developers')).body;
    const alice = developers.find((developer: { name: string }) => developer.name === 'Alice');
    const assign = await request(app).patch(`/api/tasks/${child.id}`).send({ assigneeId: alice.id });
    expect(assign.status).toBe(422);
  });

  it('saves nothing when any subtask in the tree is invalid', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Parent', subtasks: [{ title: 'Child', skillIds: [999] }] });

    expect(response.status).toBe(400);
    expect((await request(app).get('/api/tasks')).body).toHaveLength(0);
  });

  it('names a blank subtask title in the error', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Parent', subtasks: [{ title: '  ' }] });

    expect(response.status).toBe(400);
    expect(response.body.error.details[0]).toEqual({
      field: 'subtasks.0.title',
      message: 'Title is required',
    });
  });

  it('allows ten levels and rejects eleven', async () => {
    expect((await request(app).post('/api/tasks').send(nestedTask(10))).status).toBe(201);

    const tooDeep = await request(app).post('/api/tasks').send(nestedTask(11));
    expect(tooDeep.status).toBe(400);
    expect(tooDeep.body.error.details[0].message).toContain('10 levels');
  });

  it('rejects a tree with too many tasks', async () => {
    const subtasks = Array.from({ length: 100 }, (_, index) => ({ title: `Task ${index}` }));
    const response = await request(app).post('/api/tasks').send({ title: 'Parent', subtasks });
    expect(response.status).toBe(400);
  });
});

describe('reading subtasks', () => {
  it('lists only top-level tasks, with subtasks nested inside', async () => {
    await createTree();

    const list = (await request(app).get('/api/tasks')).body;
    expect(list).toHaveLength(1);
    expect(list[0].subtasks).toHaveLength(2);
    expect(list[0].subtasks[0].subtasks).toHaveLength(1);
  });

  it('reads any task with the subtasks below it', async () => {
    const { child1 } = await createTree();

    const response = await request(app).get(`/api/tasks/${child1.id}`);
    expect(response.body.title).toBe('Child 1');
    expect(response.body.subtasks.map((task: { title: string }) => task.title)).toEqual([
      'Grandchild',
    ]);
  });
});

describe('the Done rule', () => {
  it('blocks Done while a direct subtask is unfinished', async () => {
    const { parent, child1, child2, grandchild } = await createTree();
    await setStatus(grandchild.id, 'Done');
    await setStatus(child1.id, 'Done');

    const response = await setStatus(parent.id, 'Done');
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('SUBTASKS_NOT_DONE');

    await setStatus(child2.id, 'In Progress');
    expect((await setStatus(parent.id, 'Done')).status).toBe(422);
  });

  it('blocks Done while a deeper subtask is unfinished', async () => {
    const { child1 } = await createTree();
    const response = await setStatus(child1.id, 'Done');
    expect(response.status).toBe(422);
  });

  it('allows Done once every subtask is Done', async () => {
    const { parent, child1, child2, grandchild } = await createTree();
    await setStatus(grandchild.id, 'Done');
    await setStatus(child1.id, 'Done');
    await setStatus(child2.id, 'Done');

    const response = await setStatus(parent.id, 'Done');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('Done');
  });

  it('allows a task with no subtasks to be Done', async () => {
    const { child2 } = await createTree();
    expect((await setStatus(child2.id, 'Done')).status).toBe(200);
  });

  it('allows other status changes while subtasks are unfinished', async () => {
    const { parent } = await createTree();
    expect((await setStatus(parent.id, 'In Progress')).status).toBe(200);
  });

  it('blocks reopening a subtask of a Done task until the parent is reopened', async () => {
    const { parent, child1, child2, grandchild } = await createTree();
    await setStatus(grandchild.id, 'Done');
    await setStatus(child1.id, 'Done');
    await setStatus(child2.id, 'Done');
    await setStatus(parent.id, 'Done');

    const blocked = await setStatus(child2.id, 'To-do');
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe('PARENT_TASK_DONE');

    expect((await setStatus(parent.id, 'In Progress')).status).toBe(200);
    expect((await setStatus(child2.id, 'To-do')).status).toBe(200);
  });

  it('still allows assigning a subtask of a Done task', async () => {
    const { parent, child2 } = await createTree();
    await pool.query(`UPDATE tasks SET status = 'Done' WHERE id = ANY($1::int[])`, [
      [parent.id, child2.id],
    ]);
    const developers = (await request(app).get('/api/developers')).body;

    const response = await request(app)
      .patch(`/api/tasks/${child2.id}`)
      .send({ assigneeId: developers[0].id });
    expect(response.status).toBe(200);
  });

  // fires "parent done" and "reopen child" at the same time, 40 rounds
  // without the row locks in updateTask this one fails
  it('never ends with a Done parent and an unfinished subtask under simultaneous requests', async () => {
    const parent = (
      await request(app)
        .post('/api/tasks')
        .send({ title: 'Parent', subtasks: [{ title: 'Child' }] })
    ).body;
    const child = parent.subtasks[0];
    await assignEveryTaskToCarol();

    for (let round = 0; round < 40; round++) {
      await setStatus(parent.id, 'To-do');
      await setStatus(child.id, 'Done');

      await Promise.all([setStatus(parent.id, 'Done'), setStatus(child.id, 'To-do')]);

      const tree = (await request(app).get(`/api/tasks/${parent.id}`)).body;
      const broken = tree.status === 'Done' && tree.subtasks[0].status !== 'Done';
      expect(broken).toBe(false);
    }
    // 40 rounds can go past the default 5s on a slow machine or a cold docker start
  }, 30_000);
});
