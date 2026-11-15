// Cria um banco PostgreSQL (se não existir) e aplica as migrations nele.
//
// Uso: node scripts/prepare-database.mjs <nome-do-banco> [--reset [--confirmar=<nome-do-banco>]]
//   --reset  apaga e recria o schema `public` antes de migrar. APAGA TODOS OS DADOS.
//            Livre só para os bancos descartáveis de teste (`*-TEST` e `*-SMOKE`). Para
//            qualquer outro banco exige `--confirmar=<o mesmo nome>`, Postgres local e
//            NODE_ENV diferente de production (ADR-025). Nunca use num banco de produção.
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

/** Bancos que os testes recriam a cada execução: o reset é livre neles. */
const BANCO_DESCARTAVEL = /-(TEST|SMOKE)$/i;
/** Hosts de um Postgres na própria máquina (ou no docker compose de desenvolvimento). */
export const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1', 'postgres', 'host.docker.internal']);

export function databaseUrl(database) {
  const user = encodeURIComponent(process.env.DB_USERNAME ?? 'postgres');
  const password = encodeURIComponent(process.env.DB_PASSWORD ?? 'postgres');
  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '5432';
  return `postgresql://${user}:${password}@${host}:${port}/${encodeURIComponent(database)}`;
}

/**
 * Decide se o `--reset` pode apagar o banco. Devolve o motivo da recusa, ou `null` se pode.
 * Exportada para o teste das travas.
 */
export function motivoParaRecusarReset(database, { confirmacao, host, nodeEnv }) {
  if (BANCO_DESCARTAVEL.test(database)) return null;
  if (nodeEnv === 'production') {
    return 'NODE_ENV=production: o reset nunca roda em produção.';
  }
  if (!HOSTS_LOCAIS.has(String(host ?? 'localhost').toLowerCase())) {
    return `o Postgres em "${host}" não é local; o reset só apaga bancos desta máquina.`;
  }
  if (confirmacao !== database) {
    return `"${database}" não é um banco de teste (*-TEST, *-SMOKE). Para apagar mesmo assim, repita o nome: --confirmar=${database}`;
  }
  return null;
}

export async function prepareDatabase(database, { reset = false, confirmacao } = {}) {
  if (reset) {
    const motivo = motivoParaRecusarReset(database, {
      confirmacao,
      host: process.env.DB_HOST ?? 'localhost',
      nodeEnv: process.env.NODE_ENV,
    });
    if (motivo) throw new Error(`Reset recusado: ${motivo}`);
  }

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
  const args = process.argv.slice(2);
  const database = args.find((arg) => !arg.startsWith('--'));
  if (!database) {
    console.error(
      'Uso: node scripts/prepare-database.mjs <nome-do-banco> [--reset [--confirmar=<nome-do-banco>]]',
    );
    process.exit(1);
  }
  const confirmacao = args.find((arg) => arg.startsWith('--confirmar='))?.slice('--confirmar='.length);
  try {
    await prepareDatabase(database, { reset: args.includes('--reset'), confirmacao });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
