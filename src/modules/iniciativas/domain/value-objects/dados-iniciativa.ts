import { ValidacaoError } from '@/shared/domain/domain-error';
import {
  PERIODICIDADES,
  type Periodicidade,
  TIPOS_INICIATIVA,
  type TipoIniciativa,
} from '../tipos';

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

/**
 * Dados de uma iniciativa, já validados (imutável). `criar` acumula TODOS os erros de campo
 * num `ValidacaoError` (422 com `errors` por campo, com os nomes dos campos do DTO).
 */
export class DadosIniciativa {
  private constructor(
    readonly tipo: TipoIniciativa,
    readonly titulo: string,
    readonly resumo: string,
    readonly detalhe: string,
    /** `YYYY-MM-DD` */
    readonly inicio: string,
    readonly fim: string,
    /** `HH:mm`, ou null (dia inteiro). Sempre juntas com `horaFim`. */
    readonly horaInicio: string | null,
    readonly horaFim: string | null,
    readonly periodicidade: Periodicidade,
    readonly espaco: string,
    readonly organizadores: string,
    readonly membros: string | null,
    readonly participantes: number,
  ) {}

  static criar(brutos: DadosIniciativaBrutos): DadosIniciativa {
    const erros: Record<string, string> = {};

    const tipo = texto(brutos.tipo);
    if (!(TIPOS_INICIATIVA as readonly string[]).includes(tipo)) erros.tipo = 'Selecione o tipo.';

    const titulo = texto(brutos.titulo);
    if (!titulo) erros.titulo = 'Informe o título.';
    else if (titulo.length > LIMITES.titulo)
      erros.titulo = `O título deve ter no máximo ${LIMITES.titulo} caracteres.`;

    const resumo = texto(brutos.resumo);
    if (!resumo) erros.resumo = 'Escreva uma descrição resumida.';
    else if (resumo.length > LIMITES.resumo)
      erros.resumo = `A descrição resumida deve ter no máximo ${LIMITES.resumo} caracteres.`;

    const detalhe = texto(brutos.detalhe);
    if (!detalhe) erros.detalhe = 'Escreva a descrição detalhada.';
    else if (detalhe.length > LIMITES.detalhe)
      erros.detalhe = `A descrição detalhada deve ter no máximo ${LIMITES.detalhe} caracteres.`;

    const inicio = texto(brutos.inicio);
    if (!inicio) erros.inicio = 'Informe a data de início.';
    else if (!dataValida(inicio)) erros.inicio = 'Informe uma data de início válida.';

    const fim = texto(brutos.fim);
    if (!fim) erros.fim = 'Informe a data de término.';
    else if (!dataValida(fim)) erros.fim = 'Informe uma data de término válida.';
    else if (inicio && dataValida(inicio) && fim < inicio)
      erros.fim = 'A data de término deve ser igual ou posterior à de início.';

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

    const periodicidade = texto(brutos.periodicidade);
    if (!(PERIODICIDADES as readonly string[]).includes(periodicidade))
      erros.periodicidade = 'Selecione a periodicidade.';

    const espaco = texto(brutos.espaco);
    if (!espaco) erros.espaco = 'Informe o espaço utilizado.';
    else if (espaco.length > LIMITES.espaco)
      erros.espaco = `O espaço deve ter no máximo ${LIMITES.espaco} caracteres.`;

    const organizadores = texto(brutos.organizadores);
    if (!organizadores) erros.organizadores = 'Informe ao menos um organizador.';
    else if (organizadores.length > LIMITES.organizadores)
      erros.organizadores = `Os organizadores devem ter no máximo ${LIMITES.organizadores} caracteres.`;

    const membros = texto(brutos.membros);
    if (membros.length > LIMITES.membros)
      erros.membros = `Os membros devem ter no máximo ${LIMITES.membros} caracteres.`;

    const participantes = Number(brutos.participantes);
    if (!Number.isInteger(participantes) || participantes < 1)
      erros.participantes = 'Informe um número maior que zero.';
    else if (participantes > LIMITES.participantesMax)
      erros.participantes = `O número de participantes deve ser no máximo ${LIMITES.participantesMax}.`;

    if (Object.keys(erros).length > 0) {
      throw new ValidacaoError(erros);
    }

    return new DadosIniciativa(
      tipo as TipoIniciativa,
      titulo,
      resumo,
      detalhe,
      inicio,
      fim,
      horaInicio || null,
      horaFim || null,
      periodicidade as Periodicidade,
      espaco,
      organizadores,
      membros || null,
      participantes,
    );
  }

  get temHorario(): boolean {
    return this.horaInicio !== null;
  }
}
