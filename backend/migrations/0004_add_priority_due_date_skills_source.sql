-- Up Migration

-- enhancements on top of the brief

CREATE TYPE task_priority AS ENUM ('Low', 'Medium', 'High');

-- due_date is a DATE, not a timestamp, a deadline is a day not a moment
-- skills_source = who chose the skills, 'user' or 'ai' (drives the sparkle on the frontend)
-- existing tasks get Medium and 'user'
ALTER TABLE tasks
  ADD COLUMN priority task_priority NOT NULL DEFAULT 'Medium',
  ADD COLUMN due_date DATE,
  ADD COLUMN skills_source TEXT NOT NULL DEFAULT 'user' CHECK (skills_source IN ('user', 'ai'));

-- Down Migration

ALTER TABLE tasks
  DROP COLUMN skills_source,
  DROP COLUMN due_date,
  DROP COLUMN priority;

DROP TYPE task_priority;
