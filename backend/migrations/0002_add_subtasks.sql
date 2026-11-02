-- Up Migration

-- part 4: subtasks
-- a new migration instead of editing 0001, so the history shows how the design changed

-- a subtask is just a task row pointing at its parent
-- so it gets every property of a task for free and can have subtasks of its own
-- top-level tasks have no parent (null)
-- CASCADE: deleting a parent deletes its subtasks too
ALTER TABLE tasks
  ADD COLUMN parent_id INTEGER REFERENCES tasks (id) ON DELETE CASCADE,
  ADD CONSTRAINT tasks_not_own_parent CHECK (parent_id <> id);

-- speeds up finding a task's subtasks
CREATE INDEX tasks_parent_id_idx ON tasks (parent_id);

-- Down Migration

ALTER TABLE tasks
  DROP CONSTRAINT tasks_not_own_parent,
  DROP COLUMN parent_id;
