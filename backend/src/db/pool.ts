import 'dotenv/config';
import { Pool, type PoolClient } from 'pg';

// a pool reuses open connections instead of opening a new one per request
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// runs several queries as one unit, either everything saves or nothing does
export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    // undo whatever ran before the error, then let the caller deal with it
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // always hand the connection back, even after an error
    client.release();
  }
}
