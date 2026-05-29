import knex from 'knex';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dbUrl = process.env.BMAD_DB_URL;
if (!dbUrl) {
  console.error('BMAD_DB_URL environment variable is required');
  process.exit(1);
}

const isSQLite = dbUrl.startsWith('sqlite://');
const db = knex({
  client: isSQLite ? 'better-sqlite3' : 'pg',
  connection: isSQLite ? { filename: dbUrl.replace('sqlite://', '') } : dbUrl,
  useNullAsDefault: isSQLite,
  pool: isSQLite ? undefined : { min: 1, max: 5 },
  migrations: {
    directory: join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'storage', 'migrations'),
    extension: 'ts',
    tableName: 'knex_migrations',
  },
});

const command = process.argv[2] || 'latest';

async function main() {
  try {
    if (command === 'latest') {
      const [batchNo, log] = await db.migrate.latest();
      if (log.length === 0) {
        console.log('Already up to date');
      } else {
        console.log(`Batch ${batchNo} run: ${log.length} migrations`);
        for (const entry of log) {
          console.log(`  ${entry}`);
        }
      }
    } else if (command === 'rollback') {
      const [batchNo, log] = await db.migrate.rollback();
      if (log.length === 0) {
        console.log('Already at the base migration');
      } else {
        console.log(`Batch ${batchNo} rolled back: ${log.length} migrations`);
        for (const entry of log) {
          console.log(`  ${entry}`);
        }
      }
    } else if (command === 'down') {
      const [batchNo, log] = await db.migrate.down();
      if (log.length === 0) {
        console.log('Already at the base migration');
      } else {
        console.log(`Batch ${batchNo} rolled back: ${log.length} migrations`);
        for (const entry of log) {
          console.log(`  ${entry}`);
        }
      }
    } else if (command === 'list' || command === 'status') {
      const [completed] = await db.migrate.list();
      if (completed.length === 0) {
        console.log('No migrations have been run');
      } else {
        console.log('Completed migrations:');
        for (const entry of completed) {
          console.log(`  ${entry.file} (batch ${entry.batch})`);
        }
      }
    } else {
      console.error(`Unknown command: ${command}`);
      console.error('Usage: tsx scripts/migrate.ts [latest|rollback|down|list|status]');
      process.exit(1);
    }
  } catch (err) {
    console.error('Migration error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
