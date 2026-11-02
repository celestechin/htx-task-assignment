-- Up Migration
-- (the Up/Down markers are how node-pg-migrate splits the file, keep them as they are)

-- part 1: developers, skills and tasks

-- an enum so the db itself refuses a typo'd status
CREATE TYPE task_status AS ENUM ('To-do', 'In Progress', 'Done');

-- skills get their own table so "Frontend" is stored once and can't be spelt two ways
CREATE TABLE skills (
  id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE developers (
  id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL
);

-- a task has at most one assignee, so the assignee lives on the task row
-- the check stops titles that are only spaces
CREATE TABLE tasks (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title       TEXT NOT NULL CHECK (btrim(title) <> ''),
  status      task_status NOT NULL DEFAULT 'To-do',
  assignee_id INTEGER REFERENCES developers (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- speeds up "which tasks belong to this developer"
CREATE INDEX tasks_assignee_id_idx ON tasks (assignee_id);

-- many-to-many: a developer has many skills, and a skill belongs to many developers
-- the two-column primary key stops the same pair being added twice
CREATE TABLE developer_skills (
  developer_id INTEGER NOT NULL REFERENCES developers (id) ON DELETE CASCADE,
  skill_id     INTEGER NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  PRIMARY KEY (developer_id, skill_id)
);

CREATE INDEX developer_skills_skill_id_idx ON developer_skills (skill_id);

-- many-to-many: a task requires many skills, and a skill is required by many tasks
CREATE TABLE task_skills (
  task_id  INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, skill_id)
);

CREATE INDEX task_skills_skill_id_idx ON task_skills (skill_id);

-- Down Migration
-- undo in reverse order so nothing still points at a dropped table

DROP TABLE task_skills;
DROP TABLE developer_skills;
DROP TABLE tasks;
DROP TABLE developers;
DROP TABLE skills;
DROP TYPE task_status;
