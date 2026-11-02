import type { PoolClient } from 'pg';
import { pool, withTransaction } from '../db/pool';
import { ApiError } from '../errors';
import type { CreateTaskInput, TaskStatus, UpdateTaskInput } from '../validation';
import { identifySkills } from './skillIdentification';

// one query for a task with its skills and assignee
// the subqueries return json so the frontend gets the nested shape straight away
// AS "camelCase" renames the columns to match the frontend's naming
const SELECT_TASKS = `
  SELECT
    t.id,
    t.title,
    t.status,
    t.priority,
    t.due_date AS "dueDate",
    t.parent_id AS "parentId",
    t.skills_pending AS "skillsPending",
    t.skills_source AS "skillsSource",
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
  title: string;
  skillsPending: boolean;
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

// task -> skill ids picked by gemini, only for tasks that came without skills
type IdentifiedSkills = Map<CreateTaskInput, number[]>;

export async function createTask(task: CreateTaskInput) {
  // fail early on unknown skills before spending a gemini call
  await assertSkillsExist(collectSkillIds(task));

  // using Gemini to identify skills
  // done before the transaction so a slow response doesn't hold a db connection
  const identified = await identifyMissingSkills(collectTasksWithoutSkills(task));

  // the whole tree saves together or not at all
  const taskId = await withTransaction((client) => insertTask(client, task, null, identified));
  return getTask(taskId);
}

// every skill id used anywhere in the tree
function collectSkillIds(task: CreateTaskInput): number[] {
  return [...task.skillIds, ...task.subtasks.flatMap(collectSkillIds)];
}

// every task in the tree the user left without skills
function collectTasksWithoutSkills(task: CreateTaskInput): CreateTaskInput[] {
  const below = task.subtasks.flatMap(collectTasksWithoutSkills);
  return task.skillIds.length === 0 ? [task, ...below] : below;
}

async function assertSkillsExist(skillIds: number[]) {
  // dedupe first, otherwise [1, 1] would look like a missing skill
  const uniqueSkillIds = [...new Set(skillIds)];
  const found = await pool.query('SELECT id FROM skills WHERE id = ANY($1::int[])', [
    uniqueSkillIds,
  ]);
  if (found.rows.length !== uniqueSkillIds.length) {
    throw new ApiError(400, 'UNKNOWN_SKILL', 'One or more skills do not exist');
  }
}

// ask gemini for the skills of these titles and turn the names into ids
async function identifySkillIds(titles: string[]): Promise<number[][]> {
  // skills come from the db, so adding a new skill needs no code change here
  const skills = await pool.query('SELECT id, name FROM skills');
  const idsByName = new Map<string, number>(skills.rows.map((skill) => [skill.name, skill.id]));

  const skillNames = await identifySkills(titles, [...idsByName.keys()]);
  return skillNames.map((names) => names.map((name) => idsByName.get(name) as number));
}

// if gemini fails, the tasks are still saved, just without skills
// losing what the user typed felt worse than a missing skill
// tasks missing from the result are marked as skills_pending
async function identifyMissingSkills(tasks: CreateTaskInput[]): Promise<IdentifiedSkills> {
  if (tasks.length === 0) {
    return new Map();
  }

  try {
    // all titles in one call, a big tree still only costs one request
    const skillIds = await identifySkillIds(tasks.map((task) => task.title));
    return new Map(tasks.map((task, index) => [task, skillIds[index]]));
  } catch (error) {
    console.error('Skill identification failed:', (error as Error).message);
    return new Map();
  }
}

// saves one task, then calls itself for each subtask with this task as the parent
async function insertTask(
  client: PoolClient,
  task: CreateTaskInput,
  parentId: number | null,
  identified: IdentifiedSkills,
): Promise<number> {
  const chosenByUser = task.skillIds.length > 0;
  // undefined here means gemini didn't give us anything for this task
  const skillIds = chosenByUser ? task.skillIds : identified.get(task);

  const inserted = await client.query(
    `INSERT INTO tasks (title, parent_id, skills_pending, skills_source, priority, due_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      task.title,
      parentId,
      skillIds === undefined,
      chosenByUser ? 'user' : 'ai',
      task.priority,
      task.dueDate,
    ],
  );
  const id: number = inserted.rows[0].id;

  await insertTaskSkills(client, id, skillIds ?? []);

  for (const subtask of task.subtasks) {
    await insertTask(client, subtask, id, identified);
  }
  return id;
}

// unnest turns the id list into rows so all skills go in with one insert
async function insertTaskSkills(client: PoolClient, taskId: number, skillIds: number[]) {
  await client.query('INSERT INTO task_skills (task_id, skill_id) SELECT $1, unnest($2::int[])', [
    taskId,
    [...new Set(skillIds)],
  ]);
}

// the retry link: ask gemini again for a task that got saved without skills
export async function retrySkillIdentification(id: number) {
  const task = await getTask(id);
  // nothing to do if it already has skills
  if (!task.skillsPending) {
    return task;
  }

  let skillIds: number[];
  try {
    [skillIds] = await identifySkillIds([task.title]);
  } catch (error) {
    console.error('Skill identification failed:', (error as Error).message);
    throw new ApiError(
      502,
      'SKILL_IDENTIFICATION_FAILED',
      'Skills could not be identified. Please try again later.',
    );
  }

  await withTransaction(async (client) => {
    // if two retries land at once, only the first one still finds it pending
    const updated = await client.query(
      `UPDATE tasks
       SET skills_pending = false, updated_at = now()
       WHERE id = $1 AND skills_pending
       RETURNING id`,
      [id],
    );
    if (updated.rows.length > 0) {
      await insertTaskSkills(client, id, skillIds);
    }
  });

  return getTask(id);
}

// one place for every change to a task, all the rules are checked inside one transaction
export async function updateTask(id: number, changes: UpdateTaskInput) {
  const { status, assigneeId, title, skillIds, priority, dueDate } = changes;
  if (skillIds !== undefined) {
    await assertSkillsExist(skillIds);
  }

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
    // FOR UPDATE = anyone else changing this task waits for us
    const locked = await client.query('SELECT assignee_id FROM tasks WHERE id = $1 FOR UPDATE', [
      id,
    ]);

    // the assignee once this request is applied, since it can assign and change status together
    const assigneeAfterUpdate: number | null =
      assigneeId === undefined ? locked.rows[0].assignee_id : assigneeId;

    // status changes: needs an assignee first, then the done rules for subtasks
    if (status !== undefined) {
      if (assigneeAfterUpdate === null) {
        throw new ApiError(
          422,
          'TASK_NOT_ASSIGNED',
          'Please assign this task to a developer before changing its status',
        );
      }
      await assertStatusChangeAllowed(client, id, status, parent.rows[0]?.status);
    }

    // skills edited by the user replace the old ones, including any picked by gemini
    // so the sparkle goes away (skills_source becomes 'user')
    if (skillIds !== undefined) {
      await client.query('DELETE FROM task_skills WHERE task_id = $1', [id]);
      await insertTaskSkills(client, id, skillIds);
      await client.query(
        `UPDATE tasks SET skills_pending = false, skills_source = 'user' WHERE id = $1`,
        [id],
      );
    }

    // checked after the skills are replaced, so new skills get checked against the assignee too
    // otherwise an edit could sneak past the skill rule
    if (assigneeAfterUpdate !== null && (assigneeId !== undefined || skillIds !== undefined)) {
      await assertDeveloperCanTakeTask(client, id, assigneeAfterUpdate);
    }

    // fields left out of the request keep their value (COALESCE)
    // assigneeId and dueDate can also be set to null, so a separate true/false says if they were sent
    await client.query(
      `UPDATE tasks
       SET status = COALESCE($2::task_status, status),
           assignee_id = CASE WHEN $3::boolean THEN $4::int ELSE assignee_id END,
           title = COALESCE($5, title),
           priority = COALESCE($6::task_priority, priority),
           due_date = CASE WHEN $7::boolean THEN $8::date ELSE due_date END,
           updated_at = now()
       WHERE id = $1`,
      [
        id,
        status ?? null,
        assigneeId !== undefined,
        assigneeId ?? null,
        title ?? null,
        priority ?? null,
        dueDate !== undefined,
        dueDate ?? null,
      ],
    );
  });

  return getTask(id);
}

// deletes the task and all its subtasks
// ON DELETE CASCADE on parent_id does the subtasks for us
export async function deleteTask(id: number) {
  const deleted = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
  if (deleted.rows.length === 0) {
    throw new ApiError(404, 'TASK_NOT_FOUND', `Task ${id} does not exist`);
  }
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

  // no skills yet would match every developer, so block it until gemini or the user sets them
  const task = await client.query('SELECT skills_pending FROM tasks WHERE id = $1', [taskId]);
  if (task.rows[0].skills_pending) {
    throw new ApiError(
      422,
      'SKILLS_NOT_IDENTIFIED',
      "This task can't be assigned until its required skills are identified",
    );
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
