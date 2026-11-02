import { pool } from '../db/pool';
import { ApiError } from '../errors';

// each skill with the developers who have it
// COALESCE gives [] instead of null when nobody has the skill
const SELECT_SKILLS = `
  SELECT
    s.id,
    s.name,
    COALESCE(
      (
        SELECT json_agg(json_build_object('id', d.id, 'name', d.name) ORDER BY d.name)
        FROM developer_skills ds
        JOIN developers d ON d.id = ds.developer_id
        WHERE ds.skill_id = s.id
      ),
      '[]'
    ) AS developers
  FROM skills s
`;

export async function listSkills() {
  const result = await pool.query(`${SELECT_SKILLS} ORDER BY s.id`);
  return result.rows;
}

export async function getSkill(id: number) {
  const result = await pool.query(`${SELECT_SKILLS} WHERE s.id = $1`, [id]);
  if (result.rows.length === 0) {
    throw new ApiError(404, 'SKILL_NOT_FOUND', `Skill ${id} does not exist`);
  }
  return result.rows[0];
}
