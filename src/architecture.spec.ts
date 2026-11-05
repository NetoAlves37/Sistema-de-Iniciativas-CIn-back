import fs from 'node:fs';
import path from 'node:path';
import { type Node, Project, SyntaxKind } from 'ts-morph';

/**
 * Teste de arquitetura: falha se as regras de dependência entre camadas e entre módulos
 * forem violadas (ver docs/PLANO.md e o prompt de implementação, seção 3.4).
 *
 *  1. `domain` importa só o próprio `domain` e `@/shared/domain` (nenhum pacote).
 *  2. `application` importa só `domain` e `application` do próprio módulo e `@/shared/domain`.
 *     Outros módulos entram por portas (interfaces em `application/ports`), implementadas
 *     em `infrastructure/adapters`.
 *  3. `infrastructure` e `presentation` podem importar `@/common`, `@/shared`, `@/config`,
 *     `@/database` e pacotes, mas não importam uma à outra.
 *  4. Nenhum arquivo importa caminho interno de outro módulo; só o `*.facade.ts`. Apenas o
 *     `<modulo>.module.ts` pode importar o `<outro>.module.ts`.
 *  5. Só o módulo dono acessa as próprias tabelas via Prisma (`prisma.<model>` e SQL cru).
 */

const SRC = __dirname;
const BACKEND = path.resolve(SRC, '..');
const MODULES_DIR = path.join(SRC, 'modules');
const SHARED_DOMAIN = path.join(SRC, 'shared', 'domain');
const SCHEMA = path.join(BACKEND, 'prisma', 'schema.prisma');

/**
 * Exceções documentadas em docs/DECISOES.md (regra 5). Mantenha curta e sempre com motivo.
 * A única prevista: a ordenação por relevância com paginação precisa juntar `iniciativas`
 * com o placar do ciclo atual numa consulta SQL só.
 */
const EXCECOES_TABELAS: ReadonlyArray<{ arquivo: string; tabela: string; motivo: string }> = [
  {
    arquivo: 'modules/iniciativas/infrastructure/persistence/iniciativa-listagem.query.ts',
    tabela: 'votacao_placar',
    motivo: 'Ordenação por relevância com paginação no banco (RN-08.5). Ver ADR-002.',
  },
];

type Camada = 'domain' | 'application' | 'infrastructure' | 'presentation' | 'raiz';

interface Origem {
  modulo: string;
  camada: Camada;
}

function origemDe(arquivo: string): Origem | null {
  const rel = path.relative(MODULES_DIR, arquivo);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const [modulo, segundo] = rel.split(path.sep);
  if (!modulo || !segundo) return null;
  const camadas: Camada[] = ['domain', 'application', 'infrastructure', 'presentation'];
  const camada = camadas.find((c) => c === segundo);
  return { modulo, camada: camada ?? 'raiz' };
}

/** Resolve o especificador para um caminho em `src`, ou `null` se for pacote externo. */
function resolverAlvo(arquivo: string, especificador: string): string | null {
  if (especificador.startsWith('@/')) return path.join(SRC, especificador.slice(2));
  if (especificador.startsWith('.')) return path.resolve(path.dirname(arquivo), especificador);
  return null;
}

const dentroDe = (alvo: string, pasta: string): boolean => {
  const rel = path.relative(pasta, alvo);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

const fachadaDe = (modulo: string) =>
  path.join(MODULES_DIR, modulo, 'application', `${modulo}.facade`);
const moduloNestDe = (modulo: string) => path.join(MODULES_DIR, modulo, `${modulo}.module`);

/** Devolve uma mensagem de violação, ou `null` se o import é permitido. */
function verificarImport(arquivo: string, especificador: string): string | null {
  const origem = origemDe(arquivo);
  if (!origem) return null;
  const { modulo, camada } = origem;
  const alvo = resolverAlvo(arquivo, especificador);
  const raizModulo = path.join(MODULES_DIR, modulo);

  // Regra 4: acesso a outro módulo só pela fachada (ou pelo `.module` a partir do `.module`).
  if (alvo && dentroDe(alvo, MODULES_DIR) && !dentroDe(alvo, raizModulo)) {
    const outro = path.relative(MODULES_DIR, alvo).split(path.sep)[0];
    const ehFachada = alvo === fachadaDe(outro);
    const ehModuloNest =
      alvo === moduloNestDe(outro) && path.basename(arquivo) === `${modulo}.module.ts`;
    if (!ehFachada && !ehModuloNest) {
      return `regra 4: importa arquivo interno do módulo "${outro}" ("${especificador}"). Use ${outro}.facade.`;
    }
  }

  switch (camada) {
    case 'domain': {
      // Regra 1
      if (!alvo) return `regra 1: domain importa pacote externo "${especificador}".`;
      if (dentroDe(alvo, path.join(raizModulo, 'domain'))) return null;
      if (dentroDe(alvo, SHARED_DOMAIN)) return null;
      return `regra 1: domain importa fora do próprio domain e de @/shared/domain ("${especificador}").`;
    }
    case 'application': {
      // Regra 2
      if (!alvo) return `regra 2: application importa pacote externo "${especificador}".`;
      if (dentroDe(alvo, path.join(raizModulo, 'domain'))) return null;
      if (dentroDe(alvo, path.join(raizModulo, 'application'))) return null;
      if (dentroDe(alvo, SHARED_DOMAIN)) return null;
      if (dentroDe(alvo, MODULES_DIR) && !dentroDe(alvo, raizModulo)) {
        return `regra 2: application importa outro módulo ("${especificador}"). Use uma porta em application/ports.`;
      }
      return `regra 2: application importa fora de domain, application e @/shared/domain ("${especificador}").`;
    }
    case 'infrastructure':
    case 'presentation': {
      // Regra 3
      if (!alvo) return null;
      const proibida = camada === 'infrastructure' ? 'presentation' : 'infrastructure';
      if (dentroDe(alvo, path.join(raizModulo, proibida))) {
        return `regra 3: ${camada} importa ${proibida} do próprio módulo ("${especificador}").`;
      }
      if (dentroDe(alvo, raizModulo)) return null;
      if (dentroDe(alvo, MODULES_DIR)) return null; // já tratado pela regra 4
      const permitidas = ['common', 'shared', 'config', 'database'].map((p) => path.join(SRC, p));
      return permitidas.some((p) => dentroDe(alvo, p))
        ? null
        : `regra 3: ${camada} importa fora de common, shared, config e database ("${especificador}").`;
    }
    default:
      return null;
  }
}

/** `src/shared/domain` não depende de nada do restante da aplicação. */
function verificarImportSharedDomain(arquivo: string, especificador: string): string | null {
  if (!dentroDe(arquivo, SHARED_DOMAIN)) return null;
  const alvo = resolverAlvo(arquivo, especificador);
  if (!alvo) return `shared/domain importa pacote externo "${especificador}".`;
  return dentroDe(alvo, SHARED_DOMAIN)
    ? null
    : `shared/domain importa fora de si mesmo ("${especificador}").`;
}

// --- Regra 5: dono das tabelas ----------------------------------------------------------

interface MapaDeTabelas {
  /** Delegate do Prisma Client (camelCase) → módulo dono. */
  modelos: Map<string, string>;
  /** Nome da tabela no banco → módulo dono. */
  tabelas: Map<string, string>;
}

function lerSchema(): MapaDeTabelas {
  const linhas = fs.readFileSync(SCHEMA, 'utf-8').split(/\r?\n/);
  const modelos = new Map<string, string>();
  const tabelas = new Map<string, string>();
  let dono: string | null = null;
  let modelo: string | null = null;
  for (const linha of linhas) {
    const owner = linha.match(/^\/\/\/\s*owner:\s*(\w+)/);
    if (owner) dono = owner[1];
    const abre = linha.match(/^model\s+(\w+)\s*\{/);
    if (abre) {
      modelo = abre[1];
      if (dono) modelos.set(modelo.charAt(0).toLowerCase() + modelo.slice(1), dono);
    }
    const mapa = linha.match(/@@map\("([^"]+)"\)/);
    if (mapa && modelo && dono) tabelas.set(mapa[1], dono);
    if (linha.startsWith('}')) {
      modelo = null;
      dono = null;
    }
  }
  return { modelos, tabelas };
}

const RECEPTOR_PRISMA = /(prisma|client|tx|executor|db)$/i;
const CHAMADA_RAW = /\$(query|execute)Raw(Unsafe)?$/;

interface UsoDeTabela {
  linha: number;
  descricao: string;
  /** Delegate (prisma.<model>) ou tabela (SQL cru) usada. */
  nome: string;
  tipo: 'modelo' | 'tabela';
}

function tabelasEmSql(sql: string, linha: number, mapa: MapaDeTabelas): UsoDeTabela[] {
  const usos: UsoDeTabela[] = [];
  const regex = /\b(?:from|join|update|into|table)\s+"?([a-z_]+)"?/gi;
  for (const achado of sql.matchAll(regex)) {
    const tabela = achado[1];
    if (mapa.tabelas.has(tabela)) {
      usos.push({ linha, descricao: `SQL em "${tabela}"`, nome: tabela, tipo: 'tabela' });
    }
  }
  return usos;
}

function usosDeTabelas(source: Node, mapa: MapaDeTabelas): UsoDeTabela[] {
  const usos: UsoDeTabela[] = [];
  for (const acesso of source.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    const nome = acesso.getName();
    if (!mapa.modelos.has(nome)) continue;
    const receptor = acesso.getExpression().getText();
    if (!RECEPTOR_PRISMA.test(receptor)) continue;
    usos.push({
      linha: acesso.getStartLineNumber(),
      descricao: `${receptor}.${nome}`,
      nome,
      tipo: 'modelo',
    });
  }
  // SQL cru: `$queryRaw`/`$executeRaw` como template literal etiquetado ou como chamada.
  for (const tag of source.getDescendantsOfKind(SyntaxKind.TaggedTemplateExpression)) {
    if (!CHAMADA_RAW.test(tag.getTag().getText())) continue;
    usos.push(...tabelasEmSql(tag.getTemplate().getText(), tag.getStartLineNumber(), mapa));
  }
  for (const chamada of source.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (!CHAMADA_RAW.test(chamada.getExpression().getText())) continue;
    const primeiro = chamada.getArguments()[0];
    if (primeiro)
      usos.push(...tabelasEmSql(primeiro.getText(), chamada.getStartLineNumber(), mapa));
  }
  return usos;
}

function verificarDonoDasTabelas(
  arquivo: string,
  usos: UsoDeTabela[],
  mapa: MapaDeTabelas,
  excecoes: ReadonlyArray<{ arquivo: string; tabela: string; motivo: string }> = EXCECOES_TABELAS,
): string[] {
  const origem = origemDe(arquivo);
  if (!origem) return [];
  const relativo = path.relative(SRC, arquivo).split(path.sep).join('/');
  const violacoes: string[] = [];
  for (const uso of usos) {
    const dono = uso.tipo === 'modelo' ? mapa.modelos.get(uso.nome) : mapa.tabelas.get(uso.nome);
    if (!dono || dono === origem.modulo) continue;
    const permitido = excecoes.some(
      (e) => e.arquivo === relativo && e.tabela === uso.nome && e.motivo.trim() !== '',
    );
    if (!permitido) {
      violacoes.push(
        `${relativo}:${uso.linha}: regra 5: módulo "${origem.modulo}" usa ${uso.descricao}, que pertence a "${dono}".`,
      );
    }
  }
  return violacoes;
}

// --- Coleta ------------------------------------------------------------------------------

function especificadoresDe(arquivo: Node): string[] {
  const source = arquivo.getSourceFile();
  return [
    ...source.getImportDeclarations().map((d) => d.getModuleSpecifierValue()),
    ...source
      .getExportDeclarations()
      .map((d) => d.getModuleSpecifierValue())
      .filter((s): s is string => typeof s === 'string'),
  ];
}

function coletarViolacoes(): string[] {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  project.addSourceFilesAtPaths([
    path.join(MODULES_DIR, '**/*.ts'),
    path.join(SHARED_DOMAIN, '**/*.ts'),
    `!${path.join(SRC, '**/*.spec.ts')}`,
    `!${path.join(SRC, '**/*.test.ts')}`,
  ]);

  const mapa = lerSchema();
  const violacoes: string[] = [];
  for (const arquivo of project.getSourceFiles()) {
    const caminho = arquivo.getFilePath();
    const relativo = path.relative(SRC, caminho).split(path.sep).join('/');
    for (const especificador of especificadoresDe(arquivo)) {
      const mensagem =
        verificarImport(caminho, especificador) ??
        verificarImportSharedDomain(caminho, especificador);
      if (mensagem) violacoes.push(`${relativo}: ${mensagem}`);
    }
    violacoes.push(...verificarDonoDasTabelas(caminho, usosDeTabelas(arquivo, mapa), mapa));
  }
  return violacoes;
}

describe('Arquitetura dos módulos', () => {
  it('nenhum arquivo de src/modules viola as regras de dependência 1 a 5', () => {
    expect(coletarViolacoes()).toEqual([]);
  });

  it('as exceções documentadas têm motivo', () => {
    for (const excecao of EXCECOES_TABELAS) {
      expect(excecao.motivo.trim()).not.toBe('');
    }
  });

  it('o schema Prisma declara o dono de todas as tabelas', () => {
    const mapa = lerSchema();
    const modelos = fs.readFileSync(SCHEMA, 'utf-8').match(/^model\s+\w+/gm) ?? [];
    expect(mapa.modelos.size).toBe(modelos.length);
    expect(new Set(mapa.modelos.values())).toEqual(
      new Set(['identidade', 'iniciativas', 'refinamento', 'votacao']),
    );
  });
});

describe('verificarImport (o verificador pega violações)', () => {
  const dominio = path.join(MODULES_DIR, 'iniciativas', 'domain', 'iniciativa.ts');
  const aplicacao = path.join(MODULES_DIR, 'iniciativas', 'application', 'use-cases', 'x.ts');
  const infra = path.join(MODULES_DIR, 'iniciativas', 'infrastructure', 'persistence', 'r.ts');
  const apresentacao = path.join(MODULES_DIR, 'iniciativas', 'presentation', 'http', 'c.ts');
  const moduloNest = path.join(MODULES_DIR, 'iniciativas', 'iniciativas.module.ts');

  it('regra 1: domain só importa o próprio domain e @/shared/domain', () => {
    expect(verificarImport(dominio, '@nestjs/common')).toMatch(/regra 1/);
    expect(verificarImport(dominio, 'zod')).toMatch(/regra 1/);
    expect(verificarImport(dominio, '@/common/exceptions/app.exception')).toMatch(/regra 1/);
    expect(verificarImport(dominio, '@/shared/infrastructure/system-clock')).toMatch(/regra 1/);
    expect(verificarImport(dominio, '../application/dto/x')).toMatch(/regra 1/);
    expect(verificarImport(dominio, './status')).toBeNull();
    expect(verificarImport(dominio, '@/shared/domain/clock')).toBeNull();
    expect(verificarImport(dominio, '@/shared/domain/domain-error')).toBeNull();
  });

  it('regra 2: application só importa domain, application e @/shared/domain', () => {
    expect(verificarImport(aplicacao, '@nestjs/common')).toMatch(/regra 2/);
    expect(verificarImport(aplicacao, '@/database/prisma.service')).toMatch(/regra 2/);
    expect(verificarImport(aplicacao, '../../infrastructure/persistence/r')).toMatch(/regra 2/);
    expect(verificarImport(aplicacao, '../../domain/iniciativa')).toBeNull();
    expect(verificarImport(aplicacao, '../dto/x')).toBeNull();
    expect(verificarImport(aplicacao, '@/shared/domain/clock')).toBeNull();
    // Outro módulo, nem pela fachada: tem de ser por porta.
    expect(
      verificarImport(aplicacao, '@/modules/identidade/application/identidade.facade'),
    ).toMatch(/regra 2/);
    expect(verificarImport(aplicacao, '@/modules/identidade/domain/usuario')).toMatch(/regra 4/);
  });

  it('regra 3: infrastructure e presentation não se importam', () => {
    expect(verificarImport(infra, '../../presentation/http/c')).toMatch(/regra 3/);
    expect(verificarImport(apresentacao, '../../infrastructure/persistence/r')).toMatch(/regra 3/);
    expect(verificarImport(infra, '@/database/prisma.service')).toBeNull();
    expect(verificarImport(infra, '@/shared/infrastructure/prisma-transaction-host')).toBeNull();
    expect(verificarImport(infra, '../../domain/iniciativa')).toBeNull();
    expect(verificarImport(apresentacao, '../../application/iniciativas.facade')).toBeNull();
    expect(verificarImport(apresentacao, '@/common/auth/current-user.interface')).toBeNull();
    expect(verificarImport(apresentacao, '@/health/x')).toMatch(/regra 3/);
  });

  it('regra 4: nenhum módulo importa arquivo interno de outro; só a fachada', () => {
    expect(verificarImport(apresentacao, '@/modules/votacao/domain/voto')).toMatch(/regra 4/);
    expect(verificarImport(infra, '@/modules/votacao/infrastructure/persistence/r')).toMatch(
      /regra 4/,
    );
    expect(verificarImport(infra, '@/modules/votacao/application/votacao.facade')).toBeNull();
    expect(verificarImport(apresentacao, '@/modules/votacao/votacao.module')).toMatch(/regra 4/);
    expect(verificarImport(moduloNest, '@/modules/votacao/votacao.module')).toBeNull();
  });

  it('shared/domain não depende do resto da aplicação', () => {
    const arquivo = path.join(SHARED_DOMAIN, 'x.ts');
    expect(verificarImportSharedDomain(arquivo, './clock')).toBeNull();
    expect(verificarImportSharedDomain(arquivo, '@/common/x')).toMatch(/shared\/domain/);
    expect(verificarImportSharedDomain(arquivo, 'zod')).toMatch(/shared\/domain/);
  });
});

describe('regra 5 (o verificador pega acessos a tabelas de outro módulo)', () => {
  const mapa: MapaDeTabelas = {
    modelos: new Map([
      ['iniciativa', 'iniciativas'],
      ['voto', 'votacao'],
    ]),
    tabelas: new Map([
      ['iniciativas', 'iniciativas'],
      ['votacao_placar', 'votacao'],
    ]),
  };
  const arquivo = path.join(MODULES_DIR, 'iniciativas', 'infrastructure', 'persistence', 'x.ts');

  const usos = (codigo: string) => {
    const project = new Project({ useInMemoryFileSystem: true });
    return usosDeTabelas(project.createSourceFile('x.ts', codigo), mapa);
  };

  it('detecta prisma.<model> de outro dono, mas não do próprio', () => {
    const lista = usos(
      'async function f(prisma: any) { await prisma.voto.count(); await prisma.iniciativa.count(); }',
    );
    const violacoes = verificarDonoDasTabelas(arquivo, lista, mapa, []);
    expect(violacoes).toHaveLength(1);
    expect(violacoes[0]).toMatch(/usa prisma\.voto, que pertence a "votacao"/);
  });

  it('detecta tabela de outro dono em SQL cru', () => {
    const lista = usos(
      'async function f(client: any) { await client.$queryRaw`SELECT * FROM iniciativas i JOIN "votacao_placar" p ON p.x = i.id`; }',
    );
    const violacoes = verificarDonoDasTabelas(arquivo, lista, mapa, []);
    expect(violacoes).toHaveLength(1);
    expect(violacoes[0]).toMatch(/votacao_placar/);
  });

  it('aceita a exceção documentada, e só ela', () => {
    const lista = usos(
      'async function f(client: any) { await client.$queryRaw`SELECT 1 FROM votacao_placar`; }',
    );
    const relativo = path.relative(SRC, arquivo).split(path.sep).join('/');
    const comExcecao = [{ arquivo: relativo, tabela: 'votacao_placar', motivo: 'ordenação' }];
    expect(verificarDonoDasTabelas(arquivo, lista, mapa, comExcecao)).toEqual([]);
    expect(verificarDonoDasTabelas(arquivo, lista, mapa, [])).toHaveLength(1);
    const semMotivo = [{ arquivo: relativo, tabela: 'votacao_placar', motivo: ' ' }];
    expect(verificarDonoDasTabelas(arquivo, lista, mapa, semMotivo)).toHaveLength(1);
  });

  it('ignora propriedades homônimas que não são do Prisma', () => {
    expect(usos('function f(dto: any) { return dto.voto; }')).toEqual([]);
  });
});
