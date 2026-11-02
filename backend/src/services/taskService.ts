import type { PoolClient } from 'pg';
import { pool, withTransaction } from '../db/pool';
import { ApiError } from '../errors';
import type { CreateTaskInput, UpdateTaskInput } from '../validation';

// one query for a task with its skills and assignee
// the subqueries return json so the frontend gets the nested shape straight away
// AS "camelCase" renames the columns to match the frontend's naming
const SELECT_TASKS = `
  SELECT
    t.id,
    t.title,
    t.status,
    COALESCE(
      (
        SELECT json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.name)
        FROM task_skills ts
        JOIN skills s ON s.id = ts.skill_id
        WHERE ts.task_id = t.id
      ),
      '[]'
    ) AS skills,
    (
      SELECT json_build_object('id', d.id, 'name', d.name)
      FROM developers d
      WHERE d.id = t.assignee_id
    ) AS assignee,
    t.created_at AS "createdAt",
    t.updated_at AS "updatedAt"
  FROM tasks t
`;

// loads every task, ordered by id so parents come before their subtasks
export async function listTasks() {
  const result = await pool.query(`${SELECT_TASKS} ORDER BY t.id`);
  return result.rows;
}

// get one task with all the subtasks under it
export async function getTask(id: number) {
  const result = await pool.query(`${SELECT_TASKS} WHERE t.id = $1`, [id]);
  if (result.rows.length === 0) {
    throw new ApiError(404, 'TASK_NOT_FOUND', `Task ${id} does not exist`);
  }
  return result.rows[0];
}

export async function createTask({ title, skillIds }: CreateTaskInput) {
  // dedupe first, otherwise [1, 1] would look like a missing skill
  const uniqueSkillIds = [...new Set(skillIds)];

  const taskId = await withTransaction(async (client) => {
    const found = await client.query('SELECT id FROM skills WHERE id = ANY($1::int[])', [
      uniqueSkillIds,
    ]);
    if (found.rows.length !== uniqueSkillIds.length) {
      throw new ApiError(400, 'UNKNOWN_SKILL', 'One or more skills do not exist');
    }

    const inserted = await client.query('INSERT INTO tasks (title) VALUES ($1) RETURNING id', [
      title,
    ]);
    const id: number = inserted.rows[0].id;

    await client.query(
      'INSERT INTO task_skills (task_id, skill_id) SELECT $1, unnest($2::int[])',
      [id, uniqueSkillIds],
    );
    return id;
  });

  return getTask(taskId);
}

export async function updateTask(id: number, { status, assigneeId }: UpdateTaskInput) {
  await withTransaction(async (client) => {
    // FOR UPDATE makes other requests for this task wait until we finish
    const task = await client.query('SELECT id FROM tasks WHERE id = $1 FOR UPDATE', [id]);
    if (task.rows.length === 0) {
      throw new ApiError(404, 'TASK_NOT_FOUND', `Task ${id} does not exist`);
    }

    if (assigneeId !== undefined && assigneeId !== null) {
      await assertDeveloperCanTakeTask(client, id, assigneeId);
    }

    // assigneeId: undefined = leave it, null = unassign, number = assign
    await client.query(
      `UPDATE tasks
       SET status = COALESCE($2::task_status, status),
           assignee_id = CASE WHEN $3::boolean THEN $4::int ELSE assignee_id END,
           updated_at = now()
       WHERE id = $1`,
      [id, status ?? null, assigneeId !== undefined, assigneeId ?? null],
    );
  });

  return getTask(id);
}

// a developer must have every skill the task requires, not just one of them
async function assertDeveloperCanTakeTask(client: PoolClient, taskId: number, developerId: number) {
  const developer = await client.query('SELECT id FROM developers WHERE id = $1', [developerId]);
  if (developer.rows.length === 0) {
    throw new ApiError(400, 'UNKNOWN_DEVELOPER', `Developer ${developerId} does not exist`);
  }

  // skills the task needs that this developer doesn't have
  const missing = await client.query(
    `SELECT s.name
     FROM task_skills ts
     JOIN skills s ON s.id = ts.skill_id
     WHERE ts.task_id = $1
       AND NOT EXISTS (
         SELECT 1
         FROM developer_skills ds
         WHERE ds.developer_id = $2 AND ds.skill_id = ts.skill_id
       )
     ORDER BY s.name`,
    [taskId, developerId],
  );

  if (missing.rows.length > 0) {
    const skillNames = missing.rows.map((row) => row.name).join(', ');
    // reopening a subtask under a done parent would break the rule above
    throw new ApiError(
      422,
      'DEVELOPER_MISSING_SKILLS',
      `This developer is missing the required skill(s): ${skillNames}`,
    );
  }
}
