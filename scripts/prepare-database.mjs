// Cria um banco PostgreSQL (se não existir) e aplica as migrations nele.
//
// Uso: node scripts/prepare-database.mjs <nome-do-banco> [--reset]
//   --reset  apaga e recria o schema `public` antes de migrar (só para bancos descartáveis).
//
// Usa DB_HOST, DB_PORT, DB_USERNAME e DB_PASSWORD do ambiente (ou do .env), como a aplicação.
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

try {
  process.loadEnvFile('.env');
} catch {
  // sem .env: usa o ambiente (CI)
}

export function databaseUrl(database) {
  const user = encodeURIComponent(process.env.DB_USERNAME ?? 'postgres');
  const password = encodeURIComponent(process.env.DB_PASSWORD ?? 'postgres');
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '5432';
  return `postgresql://${user}:${password}@${host}:${port}/${encodeURIComponent(database)}`;
}

export async function prepareDatabase(database, { reset = false } = {}) {
  const admin = new PrismaClient({ datasources: { db: { url: databaseUrl('postgres') } } });
  try {
    const existe =
      await admin.$queryRaw`SELECT 1 AS one FROM pg_database WHERE datname = ${database}`;
    if (existe.length === 0) {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${database.replaceAll('"', '""')}"`);
    }
  } catch (error) {
    throw new Error(
      `Não foi possível preparar o banco "${database}". Suba o Postgres com ` +
        `"docker compose up -d postgres". Causa: ${error.message}`,
    );
  } finally {
    await admin.$disconnect();
  }

  const url = databaseUrl(database);
  if (reset) {
    const db = new PrismaClient({ datasources: { db: { url } } });
    try {
      await db.$executeRawUnsafe('DROP SCHEMA public CASCADE');
      await db.$executeRawUnsafe('CREATE SCHEMA public');
    } finally {
      await db.$disconnect();
    }
  }

  execSync('npx prisma migrate deploy --schema prisma/schema.prisma', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
  return url;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [database, flag] = process.argv.slice(2);
  if (!database) {
    console.error('Uso: node scripts/prepare-database.mjs <nome-do-banco> [--reset]');
    process.exit(1);
  }
  await prepareDatabase(database, { reset: flag === '--reset' });
}
