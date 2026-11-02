import { z } from 'zod';

// biggest number a postgres INTEGER column can hold
const MAX_ID = 2147483647;

// must match the task_status and task_priority enums in the migrations
export const TASK_STATUSES = ['To-do', 'In Progress', 'Done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

const id = z.number().int().positive().max(MAX_ID);

// convert URL parameters from string to int
export const idParam = z.coerce.number().int().positive().max(MAX_ID);

export const createTaskBody = z.strictObject({
  title: z.string().trim().min(1, 'Title is required').max(1000),
  skillIds: z.array(id).default([]),
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
