import type { PoolClient } from 'pg';
import { pool, withTransaction } from '../db/pool';
import { ApiError } from '../errors';
import type { CreateTaskInput, TaskStatus, UpdateTaskInput } from '../validation';

// one query for a task with its skills and assignee
// the subqueries return json so the frontend gets the nested shape straight away
// AS "camelCase" renames the columns to match the frontend's naming
const SELECT_TASKS = `
  SELECT
    t.id,
    t.title,
    t.status,
    t.parent_id AS "parentId",
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

interface TaskRow {
  id: number;
  parentId: number | null;
  [column: string]: unknown;
}

type TaskWithSubtasks = TaskRow & { subtasks: TaskWithSubtasks[] };

// the db gives back a flat list, this nests each task under its parent
// a task whose parent isn't in the list becomes a top-level task
function buildTaskTree(rows: TaskRow[]) {
  // map by id first so finding a parent is a quick lookup, not a search
  const tasksById = new Map<number, TaskWithSubtasks>(
    rows.map((row) => [row.id, { ...row, subtasks: [] }]),
  );

  const roots: TaskWithSubtasks[] = [];
  for (const task of tasksById.values()) {
    const parent = task.parentId === null ? undefined : tasksById.get(task.parentId);
    if (parent) {
      parent.subtasks.push(task);
    } else {
      roots.push(task);
    }
  }
  return roots;
}

// loads every task, ordered by id so parents come before their subtasks
export async function listTasks() {
  const result = await pool.query(`${SELECT_TASKS} ORDER BY t.id`);
  return buildTaskTree(result.rows);
}

// get one task with all the subtasks under it
export async function getTask(id: number) {
  // recursive query, starts at this task then keeps adding the children of what it found
  const result = await pool.query(
    `WITH RECURSIVE subtree AS (
       SELECT id FROM tasks WHERE id = $1
       UNION ALL
       SELECT tasks.id FROM tasks JOIN subtree ON tasks.parent_id = subtree.id
     )
     ${SELECT_TASKS}
     WHERE t.id IN (SELECT id FROM subtree)
     ORDER BY t.id`,
    [id],
  );
  if (result.rows.length === 0) {
    throw new ApiError(404, 'TASK_NOT_FOUND', `Task ${id} does not exist`);
  }
  return buildTaskTree(result.rows)[0];
}

export async function createTask(task: CreateTaskInput) {
  const taskId = await withTransaction(async (client) => {
    await assertSkillsExist(client, collectSkillIds(task));
    return insertTask(client, task, null);
  });

  return getTask(taskId);
}

// every skill id used anywhere in the tree
function collectSkillIds(task: CreateTaskInput): number[] {
  return [...task.skillIds, ...task.subtasks.flatMap(collectSkillIds)];
}

async function assertSkillsExist(client: PoolClient, skillIds: number[]) {
  // dedupe first, otherwise [1, 1] would look like a missing skill
  const uniqueSkillIds = [...new Set(skillIds)];
  const found = await client.query('SELECT id FROM skills WHERE id = ANY($1::int[])', [
    uniqueSkillIds,
  ]);
  if (found.rows.length !== uniqueSkillIds.length) {
    throw new ApiError(400, 'UNKNOWN_SKILL', 'One or more skills do not exist');
  }
}

// saves one task, then calls itself for each subtask with this task as the parent
async function insertTask(
  client: PoolClient,
  task: CreateTaskInput,
  parentId: number | null,
): Promise<number> {
  const inserted = await client.query(
    'INSERT INTO tasks (title, parent_id) VALUES ($1, $2) RETURNING id',
    [task.title, parentId],
  );
  const id: number = inserted.rows[0].id;

  await client.query('INSERT INTO task_skills (task_id, skill_id) SELECT $1, unnest($2::int[])', [
    id,
    [...new Set(task.skillIds)],
  ]);

  for (const subtask of task.subtasks) {
    await insertTask(client, subtask, id);
  }
  return id;
}

export async function updateTask(id: number, { status, assigneeId }: UpdateTaskInput) {
  await withTransaction(async (client) => {
    // parent_id never changes after creation, so it's safe to read without a lock
    const task = await client.query('SELECT parent_id FROM tasks WHERE id = $1', [id]);
    if (task.rows.length === 0) {
      throw new ApiError(404, 'TASK_NOT_FOUND', `Task ${id} does not exist`);
    }

    // lock parent first, then this task
    // if requests locked in different orders, two of them could wait on each other forever (deadlock)
    // FOR SHARE = others can read the parent but not change it until we're done
    const parent = await client.query('SELECT status FROM tasks WHERE id = $1 FOR SHARE', [
      task.rows[0].parent_id,
    ]);
    await client.query('SELECT id FROM tasks WHERE id = $1 FOR UPDATE', [id]);

    // status changes: needs an assignee first, then the done rules for subtasks
    if (status !== undefined) {
      await assertStatusChangeAllowed(client, id, status, parent.rows[0]?.status);
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

// keeps this always true: a done task only has done subtasks
// because of that, checking the direct subtasks is enough, their own subtasks are already done
async function assertStatusChangeAllowed(
  client: PoolClient,
  id: number,
  status: TaskStatus,
  parentStatus: TaskStatus | undefined,
) {
  if (status === 'Done') {
    // FOR SHARE stops anyone reopening a subtask while we're checking
    const unfinished = await client.query(
      `SELECT id
       FROM tasks
       WHERE parent_id = $1 AND status <> 'Done'
       ORDER BY id
       FOR SHARE`,
      [id],
    );
    if (unfinished.rows.length > 0) {
      throw new ApiError(
        422,
        'SUBTASKS_NOT_DONE',
        'A task can only be Done when all its subtasks are Done',
      );
    }
  } else if (parentStatus === 'Done') {
    // reopening a subtask under a done parent would break the rule above
    throw new ApiError(
      422,
      'PARENT_TASK_DONE',
      'This subtask cannot be reopened while its parent task is Done',
    );
  }
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
    throw new ApiError(
      422,
      'DEVELOPER_MISSING_SKILLS',
      `This developer is missing the required skill(s): ${skillNames}`,
    );
  }
}
