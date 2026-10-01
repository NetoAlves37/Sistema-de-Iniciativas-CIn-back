import { registerAs } from '@nestjs/config';

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DB_HOST ?? 'localhost';
  const port = process.env.DB_PORT ?? '5432';
  const username = process.env.DB_USERNAME ?? 'postgres';
  const password = process.env.DB_PASSWORD ?? 'postgres';
  const database = process.env.DB_DATABASE ?? 'BD-SICIN';

  return `postgresql://${username}:${password}@${host}:${port}/${database}`;
}

export default registerAs('database', () => {
  const url = buildDatabaseUrl();
  // Prisma lê DATABASE_URL diretamente de process.env (schema.prisma usa env("DATABASE_URL")),
  // então garantimos que ela exista mesmo quando só as variáveis DB_* foram fornecidas.
  process.env.DATABASE_URL ??= url;
  return { url };
});
