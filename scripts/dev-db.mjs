/**
 * Local development database.
 *
 * Runs a real PostgreSQL server as a plain user process - no Docker, no sudo,
 * no system install. The binary and the data directory live under .dev-db/,
 * which is gitignored.
 *
 *   npm run db:start    start it (stays in the foreground)
 *   npm run db:stop     stop it
 *   npm run db:reset    delete the data directory and start clean
 *
 * Plain ESM rather than TypeScript because embedded-postgres ships ESM-only and
 * this project compiles to CommonJS.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEV_DB_DIR = resolve(ROOT, '.dev-db');
const DATA_DIR = resolve(DEV_DB_DIR, 'data');
const PORT = Number(process.env.DEV_DB_PORT ?? 5432);
const USER = 'swasth';
const PASSWORD = 'swasth';
const DATABASE = 'swasth';

const createServer = () =>
  new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
  });

async function start() {
  const pg = createServer();

  // initialise() only works on an empty data directory; on later runs the
  // cluster already exists, so we go straight to start().
  let initialised = false;
  try {
    await pg.initialise();
    initialised = true;
  } catch {
    // Already initialised.
  }

  await pg.start();

  if (initialised) {
    await pg.createDatabase(DATABASE);
    console.log(`Created database "${DATABASE}"`);
  }

  console.log(`PostgreSQL listening on port ${PORT}`);
  console.log(
    `DATABASE_URL=postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}?schema=public`,
  );
  console.log('Press Ctrl+C to stop.');

  const shutdown = async () => {
    console.log('\nStopping PostgreSQL...');
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

async function stop() {
  await createServer().stop();
  console.log('PostgreSQL stopped');
}

async function reset() {
  try {
    await createServer().stop();
  } catch {
    // Not running - nothing to stop.
  }
  await rm(DEV_DB_DIR, { recursive: true, force: true });
  console.log('Development database deleted. Run "npm run db:start" again.');
}

const commands = { start, stop, reset };
const command = process.argv[2] ?? 'start';
const run = commands[command];

if (!run) {
  console.error(`Unknown command "${command}". Use start, stop or reset.`);
  process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
