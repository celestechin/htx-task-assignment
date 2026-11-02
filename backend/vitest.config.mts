import { defineConfig } from 'vitest/config';

// tests wipe the tasks table, so they get their own database instead of the dev one
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/task_assignment_test';

export default defineConfig({
  test: {
    globalSetup: './tests/globalSetup.ts',
    env: { DATABASE_URL: TEST_DATABASE_URL },
    // all test files share one database, so run them one at a time
    fileParallelism: false,
  },
});
