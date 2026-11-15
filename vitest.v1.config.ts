import { defineConfig } from 'vitest/config';
import base from './vitest.config';

/**
 * Suíte v1 da Sprint 3, gerada pela LLM e preservada sem edição (tests/v1-llm). Tem falhas
 * registradas de propósito na análise crítica, por isso não roda no `npm test` nem no CI.
 * Medir: `npm run test:v1` (com cobertura: `npm run test:v1 -- --coverage`).
 */
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['tests/v1-llm/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
