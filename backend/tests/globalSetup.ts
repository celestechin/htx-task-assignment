import { execSync } from 'node:child_process';
import { Client } from 'pg';

// runs once before all the tests
// creates the test database if it's missing, then migrates and seeds it
export default async function setup() {
  const url = new URL(
    process.env.TEST_DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/task_assignment_test',
  );
  const databaseName = url.pathname.slice(1);

  // can't create a database while connected to it, so connect to the default one first
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
  if (existing.rows.length === 0) {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
  }
  await admin.end();

  const options = {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'ignore' as const,
  };
  execSync('npm run migrate', options);
  execSync('npm run seed', options);
}
