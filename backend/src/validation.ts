import { z } from 'zod';

// biggest number a postgres INTEGER column can hold
const MAX_ID = 2147483647;

// must match the task_status and task_priority enums in the migrations
export const TASK_STATUSES = ['To-do', 'In Progress', 'Done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const id = z.number().int().positive().max(MAX_ID);

// convert URL parameters from string to int
export const idParam = z.coerce.number().int().positive().max(MAX_ID);

// keeps one request from creating a huge tree
export const MAX_TASK_DEPTH = 10;
export const MAX_TASKS_PER_REQUEST = 100;

// strictObject rejects any field we don't know about
const taskNode = z.strictObject({
  title: z.string().trim().min(1, 'Title is required').max(1000),
  skillIds: z.array(id).default([]),
  // getter so the schema can refer to itself, subtasks are tasks too
  get subtasks() {
    return z.array(taskNode).default([]);
  },
});

type TaskNode = z.infer<typeof taskNode>;

function depthOf(task: TaskNode): number {
  return 1 + Math.max(0, ...task.subtasks.map(depthOf));
}

function countTasks(task: TaskNode): number {
  return task.subtasks.reduce((total, subtask) => total + countTasks(subtask), 1);
}

// set a limit for number of subtask levels and tasks per tree
export const createTaskBody = taskNode.superRefine((task, context) => {
  if (depthOf(task) > MAX_TASK_DEPTH) {
    context.addIssue({
      code: 'custom',
      message: `Subtasks can be at most ${MAX_TASK_DEPTH} levels deep`,
    });
  }
  if (countTasks(task) > MAX_TASKS_PER_REQUEST) {
    context.addIssue({
      code: 'custom',
      message: `A task tree can have at most ${MAX_TASKS_PER_REQUEST} tasks`,
    });
  }
});

// every field is optional but at least one has to be sent
export const updateTaskBody = z
  .strictObject({
    status: z.enum(TASK_STATUSES).optional(),
    // null means unassign, leaving it out means don't touch it
    assigneeId: id.nullable().optional(),
  })
  .refine((body) => body.status !== undefined || body.assigneeId !== undefined, {
    message: 'Provide status or assigneeId',
  });

export type CreateTaskInput = z.infer<typeof createTaskBody>;
export type UpdateTaskInput = z.infer<typeof updateTaskBody>;
