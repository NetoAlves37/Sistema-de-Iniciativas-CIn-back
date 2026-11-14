import { vi } from 'vitest';
import type { UsuarioResumo, UsuariosPort } from '@/modules/iniciativas/application/ports/usuarios.port';
import type { GoogleAgendaPort } from '@/modules/iniciativas/application/ports/google-agenda.port';
import type {
  FiltroLeitura,
  IniciativaLeituraPort,
  LinhaCalendario,
  LinhaDetalhe,
  LinhaHistorico,
  LinhaResumo,
} from '@/modules/iniciativas/application/ports/iniciativa-leitura.port';
import { ConsultasIniciativas } from '@/modules/iniciativas/application/queries/consultas-iniciativas';
import type { Iniciativa, IniciativaProps } from '@/modules/iniciativas/domain/iniciativa';
import type { StatusIniciativa } from '@/modules/iniciativas/domain/status';
import type { IniciativaRepositoryEmMemoria } from '@/modules/iniciativas/testing/in-memory/in-memory-iniciativa.repository';
import { montar } from '@/modules/iniciativas/testing/montar-casos-de-uso';

/* ===========================================================================
 * Apoio compartilhado dos testes v2 que exercitam o "painel" (consultas).
 *
 * Não existe fake do `IniciativaLeituraPort` em testing/ (a implementação real é SQL em
 * infrastructure/persistence/iniciativa-listagem.query.ts e exige banco). Este fake lê o MESMO
 * `IniciativaRepositoryEmMemoria` que os casos de uso gravam; assim, o que um caso de uso
 * persiste (submeter, decidir...) é o que o painel enxerga.
 *
 * LIMITE: os filtros/contagens daqui reproduzem a semântica do SQL. Eles NÃO provam o SQL real;
 * provam o que `ConsultasIniciativas` faz com a porta (repasse de filtros, mapeamento de DTO).
 * ========================================================================= */

export const USUARIOS_PADRAO: Record<string, UsuarioResumo> = {
  ana: { id: 'ana', nome: 'Ana Souza', perfil: 'ALUNO' },
  bruno: { id: 'bruno', nome: 'Bruno Lima', perfil: 'PROFESSOR' },
  carla: { id: 'carla', nome: 'Carla Menezes', perfil: 'COMITE' },
};

const resumoDe = (p: IniciativaProps): LinhaResumo => ({
  id: p.id,
  autorId: p.autorId,
  tipo: p.dados.tipo,
  titulo: p.dados.titulo,
  resumo: p.dados.resumo,
  status: p.status,
  comVotacao: p.comVotacao,
  ciclo: p.ciclo,
  fimRefinamento: p.fimRefinamento,
  fimVotacao: p.fimVotacao,
  inicio: p.dados.inicio,
  fim: p.dados.fim,
  periodicidade: p.dados.periodicidade,
  espaco: p.dados.espaco,
  criadaEm: p.criadaEm,
  decididaEm: p.decididaEm,
  likes: 0,
  dislikes: 0,
  relevancia: 0,
});

const detalheDe = (p: IniciativaProps): LinhaDetalhe => ({
  ...resumoDe(p),
  detalhe: p.dados.detalhe,
  horaInicio: p.dados.horaInicio,
  horaFim: p.dados.horaFim,
  organizadores: p.dados.organizadores,
  membros: p.dados.membros,
  participantes: p.dados.participantes,
  decisorId: p.decisorId,
  justificativa: p.justificativa,
});

export class LeituraEmMemoria implements IniciativaLeituraPort {
  private readonly ids: string[] = [];

  constructor(private readonly repositorio: IniciativaRepositoryEmMemoria) {}

  /** Passa a expor no painel iniciativas já gravadas no repositório (ex.: criadas por `submeter`). */
  acompanhar(...ids: string[]): this {
    this.ids.push(...ids);
    return this;
  }

  /** Semeia no repositório e já expõe no painel. */
  semear(...iniciativas: Iniciativa[]): this {
    for (const iniciativa of iniciativas) {
      this.repositorio.semear(iniciativa);
      this.ids.push(iniciativa.id);
    }
    return this;
  }

  private todas(): IniciativaProps[] {
    return this.ids.map((id) => this.repositorio.persistida(id));
  }

  /** Ordenação: só `recentes` (criadaEm desc, id asc), que é o padrão do painel. */
  async listar(filtro: FiltroLeitura): Promise<{ linhas: LinhaResumo[]; total: number }> {
    const q = filtro.q?.toLowerCase();
    const filtradas = this.todas()
      .filter((p) => !filtro.status || p.status === filtro.status)
      .filter((p) => !filtro.tipo || p.dados.tipo === filtro.tipo)
      .filter((p) => !filtro.autorId || p.autorId === filtro.autorId)
      .filter(
        (p) =>
          !q ||
          [p.dados.titulo, p.dados.resumo, p.dados.organizadores, p.dados.espaco]
            .join(' ')
            .toLowerCase()
            .includes(q),
      )
      .sort((a, b) => b.criadaEm.getTime() - a.criadaEm.getTime() || a.id.localeCompare(b.id));
    const inicio = (filtro.page - 1) * filtro.limit;
    return {
      linhas: filtradas.slice(inicio, inicio + filtro.limit).map(resumoDe),
      total: filtradas.length,
    };
  }

  async contagemPorStatus(autorId: string): Promise<Partial<Record<StatusIniciativa, number>>> {
    const contagem: Partial<Record<StatusIniciativa, number>> = {};
    for (const p of this.todas().filter((x) => x.autorId === autorId)) {
      contagem[p.status] = (contagem[p.status] ?? 0) + 1;
    }
    return contagem;
  }

  async contarPorStatus(status: StatusIniciativa): Promise<number> {
    return this.todas().filter((p) => p.status === status).length;
  }

  async obterLinha(id: string): Promise<LinhaDetalhe | null> {
    return this.ids.includes(id) ? detalheDe(this.repositorio.persistida(id)) : null;
  }

  async historico(id: string): Promise<LinhaHistorico[]> {
    return this.repositorio.historico
      .filter((h) => h.iniciativaId === id)
      .map((h, indice) => ({
        id: `h-${indice}`,
        ciclo: h.ciclo,
        de: h.de,
        para: h.para,
        por: h.por,
        nota: h.nota,
        justificativa: h.justificativa,
        ocorreuEm: h.ocorreuEm,
      }));
  }

  async aprovadasParaCalendario(): Promise<LinhaCalendario[]> {
    throw new Error('aprovadasParaCalendario não é usado nos testes do painel.');
  }
}

const usuariosEmMemoria = (mapa: Record<string, UsuarioResumo>): UsuariosPort => ({
  async mapaPorIds(ids) {
    return new Map(ids.filter((id) => mapa[id]).map((id) => [id, mapa[id]]));
  },
});

/**
 * Monta os casos de uso de `iniciativas` (via `montar()`) junto com `ConsultasIniciativas`
 * lendo do mesmo repositório em memória.
 */
export function montarPainel(opcoes: { googleAgenda?: GoogleAgendaPort } = {}) {
  const base = montar();
  const leitura = new LeituraEmMemoria(base.repositorio);
  const googleAgenda: GoogleAgendaPort =
    opcoes.googleAgenda ?? { url: vi.fn(() => 'https://calendar.google.com/calendar/render?fake=1') };
  const consultas = new ConsultasIniciativas({
    leitura,
    usuarios: usuariosEmMemoria(USUARIOS_PADRAO),
    sugestoes: { contar: async () => new Map() },
    votos: { meuVoto: async () => 0 as const },
    googleAgenda,
    carregar: base.carregar,
    clock: base.clock,
  });
  return { ...base, leitura, consultas, googleAgenda };
}
