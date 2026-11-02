import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';

// runs db/seed.sql, used by npm run seed and on every docker start
// seed.sql only adds missing rows so running it again is safe
async function seed() {
  const sql = await readFile(path.join(process.cwd(), 'db', 'seed.sql'), 'utf8');
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  await client.connect();
  try {
    await client.query(sql);
    console.log('Seed complete');
  } finally {
    await client.end();
  }
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
