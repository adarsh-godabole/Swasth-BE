/**
 * Runs a command with the variables from an env file loaded on top of the
 * current environment.
 *
 *   node scripts/with-env.mjs .env.neon npx prisma migrate deploy
 *
 * Used so commands can be pointed at the hosted database without editing .env
 * and without pasting the connection string (and its password) into the shell
 * where it lands in your history.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [envFile, ...command] = process.argv.slice(2);

if (!envFile || command.length === 0) {
  console.error('Usage: node scripts/with-env.mjs <env-file> <command...>');
  process.exit(1);
}

let contents;
try {
  contents = readFileSync(envFile, 'utf8');
} catch {
  console.error(`Cannot read "${envFile}".`);
  console.error(
    'Create it with your hosted connection string, for example:\n' +
      '  DATABASE_URL="postgresql://user:password@host/db?sslmode=require"',
  );
  process.exit(1);
}

const env = { ...process.env };
for (const line of contents.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;

  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;

  const key = trimmed.slice(0, eq).trim();
  // Strip one layer of matching quotes; connection strings are often quoted.
  const value = trimmed
    .slice(eq + 1)
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2');
  env[key] = value;
}

if (!env.DATABASE_URL) {
  console.error(`"${envFile}" does not define DATABASE_URL.`);
  process.exit(1);
}

// Show where it is pointing, without the password.
const target = env.DATABASE_URL.replace(/\/\/([^:]+):[^@]+@/, '//$1:****@');
console.log(`Using ${envFile} -> ${target}\n`);

const child = spawn(command.join(' '), { stdio: 'inherit', shell: true, env });
child.on('exit', (code) => process.exit(code ?? 0));
