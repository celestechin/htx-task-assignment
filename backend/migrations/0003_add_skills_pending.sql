-- Up Migration

-- part 5: skills from the llm

-- true when gemini couldn't identify this task's skills
-- such a task has no skills yet, so it can't be assigned
-- (an empty skill list would otherwise match every developer)
ALTER TABLE tasks
  ADD COLUMN skills_pending BOOLEAN NOT NULL DEFAULT false;

-- Down Migration

ALTER TABLE tasks
  DROP COLUMN skills_pending;
