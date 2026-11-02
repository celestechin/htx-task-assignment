import 'dotenv/config';
import { Pool, types, type PoolClient } from 'pg';

// keep DATE columns as plain "2026-11-05" text
// pg would otherwise turn them into a js Date and the day can shift with time zones
const DATE_TYPE_ID = 1082;
types.setTypeParser(DATE_TYPE_ID, (value) => value);

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
