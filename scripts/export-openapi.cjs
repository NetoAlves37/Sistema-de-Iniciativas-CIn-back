// Exporta o contrato OpenAPI para docs/openapi.json (o front usa como referência).
// Uso: npm run openapi:export  (compila e roda; precisa do Postgres e do .env).
try {
  process.loadEnvFile('.env');
} catch {
  // sem .env
}

const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');
  const { configureApp, setupSwagger } = require('../dist/app.setup');

  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  configureApp(app);
  const document = setupSwagger(app);

  const destino = path.join(__dirname, '..', 'docs', 'openapi.json');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  console.log(`Contrato exportado em ${path.relative(process.cwd(), destino)}`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
