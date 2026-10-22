import type { Clock } from '@/shared/domain/clock';
import { IniciativaNaoEncontradaError } from '../../domain/errors/iniciativas.errors';
import type { StatusIniciativa } from '../../domain/status';
import type {
  AprovadaParaCalendarioDto,
  AtorDto,
  AutorDto,
  DetalheIniciativaDto,
  FiltroListagemDto,
  PaginaDto,
  ResumoIniciativaDto,
  TipoIniciativa,
  TransicaoDto,
} from '../dto/iniciativa.dto';
import type { GoogleAgendaPort } from '../ports/google-agenda.port';
import type {
  IniciativaLeituraPort,
  LinhaDetalhe,
  LinhaResumo,
} from '../ports/iniciativa-leitura.port';
import type { SugestoesPort } from '../ports/sugestoes.port';
import type { UsuarioResumo, UsuariosPort } from '../ports/usuarios.port';
import type { VotosPort } from '../ports/votos.port';
import type { CarregarComPrazos } from '../use-cases/carregar-com-prazos';

const iso = (data: Date | null): string | null => (data ? data.toISOString() : null);

const NOME_DESCONHECIDO = 'Membro da comunidade';

function autorDe(id: string, usuarios: Map<string, UsuarioResumo>): AutorDto {
  const usuario = usuarios.get(id);
  return {
    id,
    nome: usuario?.nome ?? NOME_DESCONHECIDO,
    perfil: usuario?.perfil ?? 'ALUNO',
  };
}

function prazoAtual(linha: LinhaResumo): Date | null {
  if (linha.status === 'EM_ANDAMENTO') return linha.fimRefinamento;
  if (linha.status === 'EM_VOTACAO') return linha.fimVotacao;
  return null;
}

function paraResumo(
  linha: LinhaResumo,
  usuarios: Map<string, UsuarioResumo>,
  sugestoes: Map<string, number>,
): ResumoIniciativaDto {
  return {
    id: linha.id,
    tipo: linha.tipo,
    titulo: linha.titulo,
    resumo: linha.resumo,
    autor: autorDe(linha.autorId, usuarios),
    status: linha.status,
    comVotacao: linha.comVotacao,
    ciclo: linha.ciclo,
    fimRefinamento: iso(linha.fimRefinamento),
    fimVotacao: iso(linha.fimVotacao),
    prazoAtual: iso(prazoAtual(linha)),
    votos: { likes: linha.likes, dislikes: linha.dislikes, relevancia: linha.relevancia },
    sugestoesCicloAtual: sugestoes.get(linha.id) ?? 0,
    inicio: linha.inicio,
    fim: linha.fim,
    periodicidade: linha.periodicidade,
    espaco: linha.espaco,
    criadaEm: linha.criadaEm.toISOString(),
    decididaEm: iso(linha.decididaEm),
  };
}

interface DepsConsultas {
  leitura: IniciativaLeituraPort;
  usuarios: UsuariosPort;
  sugestoes: SugestoesPort;
  votos: VotosPort;
  googleAgenda: GoogleAgendaPort;
  carregar: CarregarComPrazos;
  clock: Clock;
}

/** Casos de uso de leitura de `iniciativas` (listas, detalhe, histórico, calendário). */
export class ConsultasIniciativas {
  constructor(private readonly deps: DepsConsultas) {}

  /** RNF-05: filtros, ordenação e paginação no banco. */
  async listar(filtro: FiltroListagemDto): Promise<PaginaDto<ResumoIniciativaDto>> {
    const { linhas, total } = await this.deps.leitura.listar({
      status: filtro.status,
      tipo: filtro.tipo,
      q: filtro.q?.trim() || undefined,
      autorId: filtro.autorId,
      ordenar: filtro.ordenar ?? 'recentes',
      page: filtro.page,
      limit: filtro.limit,
    });
    return { items: await this.resumos(linhas), total };
  }

  /** Minhas iniciativas, com a contagem por status (todas, sem o filtro de status). */
  async minhas(
    autorId: string,
    filtro: { status?: StatusIniciativa; page: number; limit: number },
  ): Promise<
    PaginaDto<ResumoIniciativaDto> & {
      contagemPorStatus: Partial<Record<StatusIniciativa, number>>;
    }
  > {
    const [pagina, contagemPorStatus] = await Promise.all([
      this.listar({ ...filtro, autorId, ordenar: 'recentes' }),
      this.deps.leitura.contagemPorStatus(autorId),
    ]);
    return { ...pagina, contagemPorStatus };
  }

  async contagens(): Promise<{ emAnalise: number }> {
    return { emAnalise: await this.deps.leitura.contarPorStatus('EM_ANALISE') };
  }

  /** Detalhe com permissões calculadas no domínio. Aplica antes os prazos vencidos (RN-06). */
  async detalhe(id: string, ator: AtorDto): Promise<DetalheIniciativaDto> {
    const { carregar, leitura, usuarios, sugestoes, votos, googleAgenda, clock } = this.deps;
    const iniciativa = await carregar.executar(id);
    if (!iniciativa) throw new IniciativaNaoEncontradaError();
    const linha = await leitura.obterLinha(id);
    if (!linha) throw new IniciativaNaoEncontradaError();

    const ids = [linha.autorId, ...(linha.decisorId ? [linha.decisorId] : [])];
    const [mapaUsuarios, mapaSugestoes, meuVoto, ultimaJustificativa] = await Promise.all([
      usuarios.mapaPorIds(ids),
      sugestoes.contar([{ iniciativaId: linha.id, ciclo: linha.ciclo }]),
      votos.meuVoto(linha.id, linha.ciclo, ator.id),
      this.ultimaJustificativa(linha),
    ]);

    const decidida = linha.status === 'APROVADA' || linha.status === 'REPROVADA';
    return {
      ...paraResumo(linha, mapaUsuarios, mapaSugestoes),
      detalhe: linha.detalhe,
      horaInicio: linha.horaInicio,
      horaFim: linha.horaFim,
      organizadores: linha.organizadores,
      membros: linha.membros,
      participantes: linha.participantes,
      meuVoto,
      permissoes: iniciativa.permissoesPara(ator, clock),
      decisao:
        decidida && linha.decisorId && linha.decididaEm
          ? {
              resultado: linha.status as 'APROVADA' | 'REPROVADA',
              justificativa: linha.status === 'REPROVADA' ? linha.justificativa : null,
              decisor: { nome: autorDe(linha.decisorId, mapaUsuarios).nome },
              decididaEm: linha.decididaEm.toISOString(),
            }
          : null,
      ultimaJustificativa,
      googleAgendaUrl:
        linha.status === 'APROVADA'
          ? googleAgenda.url({
              titulo: linha.titulo,
              resumo: linha.resumo,
              inicio: linha.inicio,
              fim: linha.fim,
              horaInicio: linha.horaInicio,
              horaFim: linha.horaFim,
              periodicidade: linha.periodicidade,
              espaco: linha.espaco,
              organizadores: linha.organizadores,
            })
          : null,
    };
  }

  /** Histórico de transições, do mais recente para o mais antigo. */
  async historico(id: string): Promise<TransicaoDto[]> {
    const { leitura, usuarios } = this.deps;
    if (!(await leitura.obterLinha(id))) throw new IniciativaNaoEncontradaError();
    const linhas = await leitura.historico(id);
    const mapa = await usuarios.mapaPorIds(
      linhas.map((l) => l.por).filter((por) => por !== 'SISTEMA'),
    );
    // O banco devolve em ordem cronológica (instante e ordem de gravação); inverte para o mais recente primeiro.
    return linhas
      .map((l) => ({
        id: l.id,
        ciclo: l.ciclo,
        de: l.de,
        para: l.para,
        por: l.por === 'SISTEMA' ? 'Sistema' : (mapa.get(l.por)?.nome ?? NOME_DESCONHECIDO),
        nota: l.nota,
        justificativa: l.justificativa,
        ocorreuEm: l.ocorreuEm.toISOString(),
      }))
      .reverse();
  }

  async aprovadasParaCalendario(filtro: {
    de: string;
    ate: string;
    tipos?: TipoIniciativa[];
    autorId?: string;
  }): Promise<AprovadaParaCalendarioDto[]> {
    return this.deps.leitura.aprovadasParaCalendario(filtro);
  }

  // --- interno ---------------------------------------------------------------------------

  private async resumos(linhas: LinhaResumo[]): Promise<ResumoIniciativaDto[]> {
    if (linhas.length === 0) return [];
    const { usuarios, sugestoes } = this.deps;
    const [mapaUsuarios, mapaSugestoes] = await Promise.all([
      usuarios.mapaPorIds(linhas.map((l) => l.autorId)),
      sugestoes.contar(linhas.map((l) => ({ iniciativaId: l.id, ciclo: l.ciclo }))),
    ]);
    return linhas.map((linha) => paraResumo(linha, mapaUsuarios, mapaSugestoes));
  }

  /** Justificativa da última reprovação (também depois da ressubmissão, para a tela de edição). */
  private async ultimaJustificativa(linha: LinhaDetalhe): Promise<string | null> {
    if (linha.status === 'REPROVADA') return linha.justificativa;
    if (linha.ciclo <= 1) return null;
    const historico = await this.deps.leitura.historico(linha.id);
    const reprovacoes = historico.filter((h) => h.para === 'REPROVADA' && h.justificativa);
    reprovacoes.sort((a, b) => b.ocorreuEm.getTime() - a.ocorreuEm.getTime());
    return reprovacoes[0]?.justificativa ?? null;
  }
}
