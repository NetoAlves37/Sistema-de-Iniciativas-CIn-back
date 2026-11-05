import { execFileSync } from 'node:child_process';
import { TEST_DATABASE } from '../../vitest.shared';

/**
 * Cria o banco de testes (se não existir) e aplica as migrations nele. Roda uma vez antes
 * das suítes de integração e e2e. Precisa de um Postgres acessível
 * (`docker compose up -d postgres`).
 */
export default function setup(): void {
  execFileSync(process.execPath, ['scripts/prepare-database.mjs', TEST_DATABASE], {
    stdio: 'inherit',
  });
}
