import { pool } from '../db/pool';
import { ApiError } from '../errors';

// each developer with their skills and the tasks assigned to them
// the subqueries build the nested lists as json so it's one query, not one per developer
const SELECT_DEVELOPERS = `
  SELECT
    d.id,
    d.name,
    COALESCE(
      (
        SELECT json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.name)
        FROM developer_skills ds
        JOIN skills s ON s.id = ds.skill_id
        WHERE ds.developer_id = d.id
      ),
      '[]'
    ) AS skills,
    COALESCE(
      (
        SELECT json_agg(json_build_object('id', t.id, 'title', t.title, 'status', t.status) ORDER BY t.id)
        FROM tasks t
        WHERE t.assignee_id = d.id
      ),
      '[]'
    ) AS tasks
  FROM developers d
`;

export async function listDevelopers() {
  const result = await pool.query(`${SELECT_DEVELOPERS} ORDER BY d.id`);
  return result.rows;
}

export async function getDeveloper(id: number) {
  const result = await pool.query(`${SELECT_DEVELOPERS} WHERE d.id = $1`, [id]);
  if (result.rows.length === 0) {
    throw new ApiError(404, 'DEVELOPER_NOT_FOUND', `Developer ${id} does not exist`);
  }
  return result.rows[0];
}
