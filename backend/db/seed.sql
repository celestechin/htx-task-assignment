-- starting data from section 1.2 of the brief
-- safe to run again and again: rows that already exist are skipped

INSERT INTO skills (name)
VALUES ('Frontend'), ('Backend')
ON CONFLICT (name) DO NOTHING;

-- developer names aren't unique in the table, so check for each name ourselves
-- ORDER BY keeps the ids in the same order as the brief (alice = 1)
INSERT INTO developers (name)
SELECT seed.name
FROM (VALUES ('Alice'), ('Bob'), ('Carol'), ('Dave')) AS seed (name)
WHERE NOT EXISTS (SELECT 1 FROM developers WHERE developers.name = seed.name)
ORDER BY seed.name;

-- link developers to skills by name so we don't depend on the generated ids
INSERT INTO developer_skills (developer_id, skill_id)
SELECT developers.id, skills.id
FROM (
  VALUES
    ('Alice', 'Frontend'),
    ('Bob', 'Backend'),
    ('Carol', 'Frontend'),
    ('Carol', 'Backend'),
    ('Dave', 'Backend')
) AS seed (developer_name, skill_name)
JOIN developers ON developers.name = seed.developer_name
JOIN skills ON skills.name = seed.skill_name
ON CONFLICT (developer_id, skill_id) DO NOTHING;

-- demo tasks: the 3 from the wireframe, so the list isn't empty on first start
-- not required by the brief
-- due dates count from the day the seed runs so the demo always shows a mix of colours
WITH demo (position, title, skill_names, assignee_name, priority, due_in_days) AS (
  VALUES
    (1, 'As a visitor, I want to see a responsive homepage so that I can easily navigate on both desktop and mobile devices.', ARRAY['Frontend'], 'Alice', 'High', 2),
    (2, 'As a system administrator, I want audit logs of all data access and modifications so that I can ensure compliance with data protection regulations and investigate any security incidents.', ARRAY['Backend'], NULL, 'Medium', 10),
    (3, 'As a logged-in user, I want to update my profile information and upload a profile picture so that my account details are accurate and personalized.', ARRAY['Frontend', 'Backend'], NULL, 'Low', NULL)
),
-- only add a demo task if no top-level task has that title yet
inserted AS (
  INSERT INTO tasks (title, assignee_id, priority, due_date)
  SELECT
    demo.title,
    developers.id,
    demo.priority::task_priority,
    current_date + demo.due_in_days::int
  FROM demo
  LEFT JOIN developers ON developers.name = demo.assignee_name
  WHERE NOT EXISTS (
    SELECT 1 FROM tasks WHERE tasks.title = demo.title AND tasks.parent_id IS NULL
  )
  ORDER BY demo.position
  RETURNING id, title
)
-- skills only get linked to the tasks added just now, never to existing ones
INSERT INTO task_skills (task_id, skill_id)
SELECT inserted.id, skills.id
FROM inserted
JOIN demo ON demo.title = inserted.title
CROSS JOIN LATERAL unnest(demo.skill_names) AS skill_name
JOIN skills ON skills.name = skill_name;
