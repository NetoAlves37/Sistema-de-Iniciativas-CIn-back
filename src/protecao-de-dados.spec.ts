import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Proteção dos dados de produção (ADR-025). Este sistema roda em produção e nunca pode perder
 * dados nem receber dados fictícios. Os testes abaixo travam, sem banco:
 *
 *  1. migrations: nenhuma migration pode apagar dados (DROP TABLE/COLUMN/SCHEMA/DATABASE,
 *     DELETE, TRUNCATE) sem estar na lista de exceções aprovadas, com o motivo;
 *  2. seed de demonstração: recusa produção e bancos fora desta máquina;
 *  3. `prepare-database --reset`: recusa produção, bancos remotos e bancos que não são de
 *     teste sem a confirmação explícita do nome.
 */
const BACKEND = path.resolve(__dirname, '..');
const MIGRATIONS = path.join(BACKEND, 'prisma', 'migrations');

/** Comandos SQL que apagam dados (ou estruturas com dados). */
const DESTRUTIVOS: ReadonlyArray<{ nome: string; regex: RegExp }> = [
  { nome: 'DROP TABLE', regex: /\bDROP\s+TABLE\b/i },
  { nome: 'DROP COLUMN', regex: /\bDROP\s+COLUMN\b/i },
  { nome: 'DROP SCHEMA', regex: /\bDROP\s+SCHEMA\b/i },
  { nome: 'DROP DATABASE', regex: /\bDROP\s+DATABASE\b/i },
  { nome: 'DELETE', regex: /\bDELETE\s+FROM\b/i },
  { nome: 'TRUNCATE', regex: /\bTRUNCATE\b/i },
];

/**
 * Exceções aprovadas. Mantenha curta, sempre com o motivo e a decisão em docs/DECISOES.md.
 * Uma migration nova que apague dados precisa entrar aqui de propósito, na revisão.
 */
const EXCECOES: ReadonlyArray<{ migration: string; comando: string; motivo: string }> = [
  {
    migration: '20261022120100_remove_task',
    comando: 'DROP TABLE',
    motivo: 'Remove as tabelas de exemplo do boilerplate (tasks), que nunca tiveram dados reais.',
  },
  {
    migration: '20261115120000_cadastro_tipos_iniciativa',
    comando: 'DELETE',
    motivo:
      'Remove os 3 tipos de fábrica só em banco sem nenhuma iniciativa, para a instalação nova começar sem tipos (ADR-024).',
  },
];

/** SQL sem comentários (`-- ...` e `/* ... *\/`), para não acusar texto explicativo. */
function semComentarios(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
}

function migrations(): string[] {
  return fs
    .readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name)
    .sort();
}

describe('Proteção de dados: migrations', () => {
  it('nenhuma migration apaga dados fora das exceções aprovadas', () => {
    const violacoes: string[] = [];
    for (const migration of migrations()) {
      const sql = semComentarios(
        fs.readFileSync(path.join(MIGRATIONS, migration, 'migration.sql'), 'utf8'),
      );
      for (const { nome, regex } of DESTRUTIVOS) {
        if (!regex.test(sql)) continue;
        const aprovada = EXCECOES.some((e) => e.migration === migration && e.comando === nome);
        if (!aprovada) violacoes.push(`${migration}: ${nome}`);
      }
    }
    expect(violacoes, 'Migration que apaga dados sem exceção aprovada').toEqual([]);
  });

  it('toda exceção aponta para uma migration e um comando que existem (sem exceção morta)', () => {
    for (const excecao of EXCECOES) {
      const arquivo = path.join(MIGRATIONS, excecao.migration, 'migration.sql');
      expect(fs.existsSync(arquivo), excecao.migration).toBe(true);
      const sql = semComentarios(fs.readFileSync(arquivo, 'utf8'));
      const comando = DESTRUTIVOS.find((d) => d.nome === excecao.comando);
      expect(comando?.regex.test(sql), `${excecao.migration}: ${excecao.comando}`).toBe(true);
    }
  });

  it('o DELETE da migration de tipos só alcança os 3 tipos de fábrica, e só sem iniciativas', () => {
    const sql = semComentarios(
      fs.readFileSync(
        path.join(MIGRATIONS, '20261115120000_cadastro_tipos_iniciativa', 'migration.sql'),
        'utf8',
      ),
    ).replace(/\s+/g, ' ');
    expect(sql).toContain(
      `DELETE FROM "iniciativas_tipos" WHERE "code" IN ('EXTENSAO', 'PESQUISA', 'EVENTO') AND NOT EXISTS (SELECT 1 FROM "iniciativas");`,
    );
  });

  it('o verificador acusa comandos destrutivos e ignora comentários', () => {
    const acusa = (sql: string) =>
      DESTRUTIVOS.filter(({ regex }) => regex.test(semComentarios(sql))).map((d) => d.nome);
    expect(acusa('DELETE FROM "x";')).toEqual(['DELETE']);
    expect(acusa('ALTER TABLE "x" DROP COLUMN "y";')).toEqual(['DROP COLUMN']);
    expect(acusa('truncate "x";')).toEqual(['TRUNCATE']);
    expect(acusa('-- DELETE FROM "x"\n/* DROP TABLE "y" */ SELECT 1;')).toEqual([]);
    expect(acusa('ALTER TABLE "x" DROP CONSTRAINT "c"; ALTER TABLE "x" ALTER COLUMN "a" DROP DEFAULT;')).toEqual([]);
  });
});

/** Roda um script do backend com o ambiente dado. Todos os casos saem antes de tocar no banco. */
function rodar(script: string, args: string[], env: Record<string, string | undefined>) {
  const resultado = spawnSync(process.execPath, [script, ...args], {
    cwd: BACKEND,
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
    encoding: 'utf8',
    timeout: 30_000,
  });
  return { status: resultado.status, saida: `${resultado.stdout}${resultado.stderr}` };
}

describe('Proteção de dados: seed de demonstração', () => {
  const seed = (env: Record<string, string | undefined>) => rodar('prisma/seed.mjs', [], env);

  it('recusa NODE_ENV=production, mesmo com PERMITIR_SEED_DEMO=true', () => {
    const { status, saida } = seed({
      NODE_ENV: 'production',
      PERMITIR_SEED_DEMO: 'true',
      DATABASE_URL: 'postgresql://u:p@localhost:5432/BD-SICIN',
    });
    expect(status).toBe(1);
    expect(saida).toContain('não roda em produção');
  });

  it('recusa um banco fora desta máquina', () => {
    const { status, saida } = seed({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://u:p@db.producao.exemplo:5432/BD-SICIN',
    });
    expect(status).toBe(1);
    expect(saida).toContain('Seed recusado');
    expect(saida).toContain('db.producao.exemplo');
  });

  it('recusa sem DATABASE_URL', () => {
    const { status, saida } = seed({ NODE_ENV: 'development', DATABASE_URL: 'não é uma url' });
    expect(status).toBe(1);
    expect(saida).toContain('DATABASE_URL ausente ou inválida');
  });
});

describe('Proteção de dados: prepare-database --reset', () => {
  const preparar = (args: string[], env: Record<string, string | undefined> = {}) =>
    rodar('scripts/prepare-database.mjs', args, { DB_HOST: 'localhost', ...env });

  it('recusa apagar um banco que não é de teste sem a confirmação do nome', () => {
    const { status, saida } = preparar(['BD-SICIN', '--reset']);
    expect(status).toBe(1);
    expect(saida).toContain('Reset recusado');
    expect(saida).toContain('--confirmar=BD-SICIN');
  });

  it('a confirmação precisa ser exatamente o nome do banco', () => {
    const { status } = preparar(['BD-SICIN', '--reset', '--confirmar=BD-OUTRO']);
    expect(status).toBe(1);
  });

  it('recusa em produção, mesmo confirmado', () => {
    const { status, saida } = preparar(['BD-SICIN', '--reset', '--confirmar=BD-SICIN'], {
      NODE_ENV: 'production',
    });
    expect(status).toBe(1);
    expect(saida).toContain('nunca roda em produção');
  });

  it('recusa um Postgres remoto, mesmo confirmado', () => {
    const { status, saida } = preparar(['BD-SICIN', '--reset', '--confirmar=BD-SICIN'], {
      DB_HOST: 'db.producao.exemplo',
    });
    expect(status).toBe(1);
    expect(saida).toContain('não é local');
  });
});
