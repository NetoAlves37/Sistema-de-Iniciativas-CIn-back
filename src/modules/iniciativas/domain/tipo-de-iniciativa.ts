import { ValidacaoError } from '@/shared/domain/domain-error';
import { FORMATO_CODIGO_TIPO } from '@/shared/domain/vocabulario-iniciativa';

export const LIMITE_NOME_TIPO = 60;
const FORMATO_COR = /^#[0-9A-Fa-f]{6}$/;

/** Campos de um tipo que aparecem no log (antes e depois). */
export interface CamposTipo {
  nome: string;
  cor: string;
  ativo: boolean;
}

export interface TipoDeIniciativaProps extends CamposTipo {
  id: number;
  code: string;
}

/** Ação registrada no log de auditoria do cadastro de tipos (lookup `iniciativas_tipos_acoes`). */
export type AcaoTipo = 'CRIADO' | 'ALTERADO' | 'ATIVADO' | 'DESATIVADO' | 'EXCLUIDO';

/** Uma entrada do log, montada pelo domínio e gravada pelo repositório na mesma transação. */
export interface RegistroTipo {
  acao: AcaoTipo;
  /** Só os campos que mudaram (`null` na criação). */
  antes: Partial<CamposTipo> | null;
  /** Só os campos que mudaram (`null` na exclusão). */
  depois: Partial<CamposTipo> | null;
}

/**
 * Nome comparável: sem acento, minúsculo e com espaços simples. "Liga  Acadêmica" e
 * "liga academica" são o mesmo nome (não podem coexistir).
 */
export function normalizarNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Código a partir do nome: "Liga Acadêmica" → `LIGA_ACADEMICA`. */
export function codigoDoNome(nome: string): string {
  const base = normalizarNome(nome)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 34);
  return base || 'TIPO';
}

function validar(campos: { nome?: unknown; cor?: unknown }): { nome: string; cor: string } {
  const erros: Record<string, string> = {};
  const nome = typeof campos.nome === 'string' ? campos.nome.trim().replace(/\s+/g, ' ') : '';
  if (!nome) erros.nome = 'Informe o nome do tipo.';
  else if (nome.length > LIMITE_NOME_TIPO)
    erros.nome = `O nome deve ter no máximo ${LIMITE_NOME_TIPO} caracteres.`;
  const cor = typeof campos.cor === 'string' ? campos.cor.trim() : '';
  if (!cor) erros.cor = 'Escolha a cor do tipo.';
  else if (!FORMATO_COR.test(cor)) erros.cor = 'Informe a cor no formato #RRGGBB.';
  if (Object.keys(erros).length > 0) throw new ValidacaoError(erros);
  return { nome, cor: cor.toUpperCase() };
}

/**
 * Tipo de iniciativa cadastrado pelo comitê ou pelo ADMIN. O `code` é gerado do nome na
 * criação e nunca muda (as iniciativas e os filtros usam o código); o nome e a cor podem ser
 * alterados. Cada mudança gera um `RegistroTipo` para o log de auditoria.
 */
export class TipoDeIniciativa {
  private registros: RegistroTipo[] = [];

  private constructor(private props: TipoDeIniciativaProps) {}

  /**
   * Cria um tipo ativo. `codigosEmUso` evita repetir o código (por exemplo, quando um tipo
   * renomeado ainda tem o código do nome antigo): acrescenta `_2`, `_3`...
   */
  static criar(
    campos: { nome?: unknown; cor?: unknown },
    codigosEmUso: ReadonlySet<string>,
  ): TipoDeIniciativa {
    const { nome, cor } = validar(campos);
    const base = codigoDoNome(nome);
    let code = base;
    for (let n = 2; codigosEmUso.has(code); n++) code = `${base}_${n}`;
    if (!FORMATO_CODIGO_TIPO.test(code)) throw new ValidacaoError({ nome: 'Nome inválido.' });
    const tipo = new TipoDeIniciativa({ id: 0, code, nome, cor, ativo: true });
    tipo.registros.push({ acao: 'CRIADO', antes: null, depois: { nome, cor, ativo: true } });
    return tipo;
  }

  static reconstituir(props: TipoDeIniciativaProps): TipoDeIniciativa {
    return new TipoDeIniciativa({ ...props });
  }

  get id(): number {
    return this.props.id;
  }
  get code(): string {
    return this.props.code;
  }
  get nome(): string {
    return this.props.nome;
  }
  get cor(): string {
    return this.props.cor;
  }
  get ativo(): boolean {
    return this.props.ativo;
  }

  /**
   * Renomeia e/ou troca a cor (campos ausentes ficam como estão). Não registra nada se nada
   * mudou de fato.
   */
  alterar(campos: { nome?: unknown; cor?: unknown }): void {
    const { nome, cor } = validar({
      nome: campos.nome === undefined ? this.props.nome : campos.nome,
      cor: campos.cor === undefined ? this.props.cor : campos.cor,
    });
    const antes: Partial<CamposTipo> = {};
    const depois: Partial<CamposTipo> = {};
    if (nome !== this.props.nome) {
      antes.nome = this.props.nome;
      depois.nome = nome;
    }
    if (cor !== this.props.cor) {
      antes.cor = this.props.cor;
      depois.cor = cor;
    }
    if (Object.keys(depois).length === 0) return;
    this.props = { ...this.props, nome, cor };
    this.registros.push({ acao: 'ALTERADO', antes, depois });
  }

  /** Ativa ou desativa. Sem efeito (nem registro) se já está no estado pedido. */
  definirAtivo(ativo: boolean): void {
    if (ativo === this.props.ativo) return;
    this.props = { ...this.props, ativo };
    this.registros.push({
      acao: ativo ? 'ATIVADO' : 'DESATIVADO',
      antes: { ativo: !ativo },
      depois: { ativo },
    });
  }

  /** Registro da exclusão. Quem confere se há iniciativas associadas é o caso de uso. */
  registroDeExclusao(): RegistroTipo {
    return {
      acao: 'EXCLUIDO',
      antes: { nome: this.props.nome, cor: this.props.cor, ativo: this.props.ativo },
      depois: null,
    };
  }

  /** Registros ainda não gravados (o repositório os grava junto com o tipo). */
  pullRegistros(): RegistroTipo[] {
    const registros = this.registros;
    this.registros = [];
    return registros;
  }
}
