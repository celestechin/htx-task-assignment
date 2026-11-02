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
