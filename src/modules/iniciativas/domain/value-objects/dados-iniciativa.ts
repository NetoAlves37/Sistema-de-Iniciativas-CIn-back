import { ValidacaoError } from '@/shared/domain/domain-error';
import {
  FORMATO_CODIGO_TIPO,
  PERIODICIDADES,
  type Periodicidade,
  type TipoIniciativa,
} from '@/shared/domain/vocabulario-iniciativa';

/** Entrada bruta (como veio do HTTP). Todos os campos são validados aqui (RN-01 e RN-02). */
export interface DadosIniciativaBrutos {
  tipo?: unknown;
  titulo?: unknown;
  resumo?: unknown;
  detalhe?: unknown;
  inicio?: unknown;
  fim?: unknown;
  horaInicio?: unknown;
  horaFim?: unknown;
  periodicidade?: unknown;
  espaco?: unknown;
  organizadores?: unknown;
  membros?: unknown;
  participantes?: unknown;
}

/** Só as datas e os horários (alteração de datas de uma aprovada). */
export type DatasIniciativaBrutas = Pick<
  DadosIniciativaBrutos,
  'inicio' | 'fim' | 'horaInicio' | 'horaFim'
>;

export const LIMITES = {
  titulo: 120,
  resumo: 280,
  detalhe: 5000,
  espaco: 200,
  organizadores: 500,
  membros: 500,
  participantesMax: 100_000,
} as const;

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function dataValida(valor: string): boolean {
  if (!REGEX_DATA.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
  );
}

/** Texto aparado, ou `''` quando não é string. */
const texto = (valor: unknown): string => (typeof valor === 'string' ? valor.trim() : '');

/** Erros de campo acumulados durante a validação (campo do DTO → mensagem). */
type Erros = Record<string, string>;

/** Regra de um campo de texto: mensagem quando vazio (só nos obrigatórios) e tamanho máximo. */
interface RegraTexto {
  readonly vazio?: string;
  readonly limite: number;
  readonly longo: string;
}

const REGRAS_TEXTO = {
  titulo: {
    vazio: 'Informe o título.',
    limite: LIMITES.titulo,
    longo: `O título deve ter no máximo ${LIMITES.titulo} caracteres.`,
  },
  resumo: {
    vazio: 'Escreva uma descrição resumida.',
    limite: LIMITES.resumo,
    longo: `A descrição resumida deve ter no máximo ${LIMITES.resumo} caracteres.`,
  },
  detalhe: {
    vazio: 'Escreva a descrição detalhada.',
    limite: LIMITES.detalhe,
    longo: `A descrição detalhada deve ter no máximo ${LIMITES.detalhe} caracteres.`,
  },
  espaco: {
    vazio: 'Informe o espaço utilizado.',
    limite: LIMITES.espaco,
    longo: `O espaço deve ter no máximo ${LIMITES.espaco} caracteres.`,
  },
  organizadores: {
    vazio: 'Informe ao menos um organizador.',
    limite: LIMITES.organizadores,
    longo: `Os organizadores devem ter no máximo ${LIMITES.organizadores} caracteres.`,
  },
  membros: {
    limite: LIMITES.membros,
    longo: `Os membros devem ter no máximo ${LIMITES.membros} caracteres.`,
  },
} as const satisfies Record<string, RegraTexto>;

/** Campo de texto: aparado; vazio só é erro quando o campo é obrigatório (RN-01). */
function validarTexto(valor: unknown, campo: keyof typeof REGRAS_TEXTO, erros: Erros): string {
  const regra: RegraTexto = REGRAS_TEXTO[campo];
  const aparado = texto(valor);
  if (!aparado) {
    if (regra.vazio) erros[campo] = regra.vazio;
  } else if (aparado.length > regra.limite) {
    erros[campo] = regra.longo;
  }
  return aparado;
}

/** Tipo: formato do código e, quando informada, a lista de tipos que podem ser escolhidos. */
function validarTipo(
  valor: unknown,
  tiposPermitidos: ReadonlySet<string> | undefined,
  erros: Erros,
): TipoIniciativa {
  const tipo = texto(valor);
  if (!tipo || !FORMATO_CODIGO_TIPO.test(tipo)) erros.tipo = 'Selecione o tipo.';
  else if (tiposPermitidos && !tiposPermitidos.has(tipo))
    erros.tipo = 'Este tipo não existe ou foi desativado. Selecione outro.';
  return tipo;
}

/** Datas (RN-02): obrigatórias, `YYYY-MM-DD` existentes, e o término não antes do início. */
function validarDatas(brutos: DatasIniciativaBrutas, erros: Erros) {
  const inicio = texto(brutos.inicio);
  if (!inicio) erros.inicio = 'Informe a data de início.';
  else if (!dataValida(inicio)) erros.inicio = 'Informe uma data de início válida.';

  const fim = texto(brutos.fim);
  if (!fim) erros.fim = 'Informe a data de término.';
  else if (!dataValida(fim)) erros.fim = 'Informe uma data de término válida.';
  else if (inicio && dataValida(inicio) && fim < inicio)
    erros.fim = 'A data de término deve ser igual ou posterior à de início.';

  return { inicio, fim };
}

/** Horários (RN-02): os dois ou nenhum (dia inteiro), `HH:mm`, e o término depois do início. */
function validarHorario(brutos: DatasIniciativaBrutas, erros: Erros) {
  const horaInicio = texto(brutos.horaInicio);
  const horaFim = texto(brutos.horaFim);
  if (horaInicio && !horaFim) {
    erros.horaFim = 'Informe a hora de término ou apague a de início.';
  } else if (!horaInicio && horaFim) {
    erros.horaInicio = 'Informe a hora de início ou apague a de término.';
  } else if (horaInicio && horaFim) {
    if (!REGEX_HORA.test(horaInicio)) erros.horaInicio = 'Informe uma hora de início válida.';
    if (!REGEX_HORA.test(horaFim)) erros.horaFim = 'Informe uma hora de término válida.';
    else if (REGEX_HORA.test(horaInicio) && horaFim <= horaInicio)
      erros.horaFim = 'A hora de término deve ser posterior à de início.';
  }
  return { horaInicio: horaInicio || null, horaFim: horaFim || null };
}

function validarPeriodicidade(valor: unknown, erros: Erros): Periodicidade {
  const periodicidade = texto(valor);
  if (!(PERIODICIDADES as readonly string[]).includes(periodicidade))
    erros.periodicidade = 'Selecione a periodicidade.';
  return periodicidade as Periodicidade;
}

/** Participantes: inteiro de 1 até `LIMITES.participantesMax`. */
function validarParticipantes(valor: unknown, erros: Erros): number {
  const participantes = Number(valor);
  if (!Number.isInteger(participantes) || participantes < 1)
    erros.participantes = 'Informe um número maior que zero.';
  else if (participantes > LIMITES.participantesMax)
    erros.participantes = `O número de participantes deve ser no máximo ${LIMITES.participantesMax}.`;
  return participantes;
}

/** Campos já validados, que o construtor recebe (em vez de 13 parâmetros posicionais). */
interface CamposDadosIniciativa {
  readonly tipo: TipoIniciativa;
  readonly titulo: string;
  readonly resumo: string;
  readonly detalhe: string;
  readonly inicio: string;
  readonly fim: string;
  readonly horaInicio: string | null;
  readonly horaFim: string | null;
  readonly periodicidade: Periodicidade;
  readonly espaco: string;
  readonly organizadores: string;
  readonly membros: string | null;
  readonly participantes: number;
}

/**
 * Dados de uma iniciativa, já validados (imutável). `criar` acumula TODOS os erros de campo
 * num `ValidacaoError` (422 com `errors` por campo, com os nomes dos campos do DTO).
 */
export class DadosIniciativa implements CamposDadosIniciativa {
  readonly tipo: TipoIniciativa;
  readonly titulo: string;
  readonly resumo: string;
  readonly detalhe: string;
  /** `YYYY-MM-DD` */
  readonly inicio: string;
  readonly fim: string;
  /** `HH:mm`, ou null (dia inteiro). Sempre juntas com `horaFim`. */
  readonly horaInicio: string | null;
  readonly horaFim: string | null;
  readonly periodicidade: Periodicidade;
  readonly espaco: string;
  readonly organizadores: string;
  readonly membros: string | null;
  readonly participantes: number;

  private constructor(campos: CamposDadosIniciativa) {
    this.tipo = campos.tipo;
    this.titulo = campos.titulo;
    this.resumo = campos.resumo;
    this.detalhe = campos.detalhe;
    this.inicio = campos.inicio;
    this.fim = campos.fim;
    this.horaInicio = campos.horaInicio;
    this.horaFim = campos.horaFim;
    this.periodicidade = campos.periodicidade;
    this.espaco = campos.espaco;
    this.organizadores = campos.organizadores;
    this.membros = campos.membros;
    this.participantes = campos.participantes;
  }

  /**
   * `tiposPermitidos`: códigos dos tipos que podem ser escolhidos (os ativos do cadastro, e o
   * tipo atual da iniciativa na edição). O caso de uso sempre informa; sem ele, só o formato
   * do código é conferido (usado ao revalidar dados que já foram aceitos, como em `comDatas`).
   *
   * Os campos são validados na ordem do formulário, e os erros saem nessa mesma ordem.
   */
  static criar(
    brutos: DadosIniciativaBrutos,
    tiposPermitidos?: ReadonlySet<string>,
  ): DadosIniciativa {
    const erros: Erros = {};
    const tipo = validarTipo(brutos.tipo, tiposPermitidos, erros);
    const titulo = validarTexto(brutos.titulo, 'titulo', erros);
    const resumo = validarTexto(brutos.resumo, 'resumo', erros);
    const detalhe = validarTexto(brutos.detalhe, 'detalhe', erros);
    const { inicio, fim } = validarDatas(brutos, erros);
    const { horaInicio, horaFim } = validarHorario(brutos, erros);
    const periodicidade = validarPeriodicidade(brutos.periodicidade, erros);
    const espaco = validarTexto(brutos.espaco, 'espaco', erros);
    const organizadores = validarTexto(brutos.organizadores, 'organizadores', erros);
    const membros = validarTexto(brutos.membros, 'membros', erros) || null;
    const participantes = validarParticipantes(brutos.participantes, erros);

    if (Object.keys(erros).length > 0) {
      throw new ValidacaoError(erros);
    }

    return new DadosIniciativa({
      tipo,
      titulo,
      resumo,
      detalhe,
      inicio,
      fim,
      horaInicio,
      horaFim,
      periodicidade,
      espaco,
      organizadores,
      membros,
      participantes,
    });
  }

  /**
   * Cópia com novas datas e horários (os demais campos ficam como estão). Revalida com as
   * mesmas regras de `criar` (RN-02), então só os erros de data e hora podem aparecer.
   */
  comDatas(datas: DatasIniciativaBrutas): DadosIniciativa {
    return DadosIniciativa.criar({
      tipo: this.tipo,
      titulo: this.titulo,
      resumo: this.resumo,
      detalhe: this.detalhe,
      periodicidade: this.periodicidade,
      espaco: this.espaco,
      organizadores: this.organizadores,
      membros: this.membros,
      participantes: this.participantes,
      inicio: datas.inicio,
      fim: datas.fim,
      horaInicio: datas.horaInicio,
      horaFim: datas.horaFim,
    });
  }

  get temHorario(): boolean {
    return this.horaInicio !== null;
  }
}
