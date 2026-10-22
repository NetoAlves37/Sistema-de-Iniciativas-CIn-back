import { DomainError, ValidacaoError } from '@/shared/domain/domain-error';
import type { DetalheIniciativa, ResumoIniciativa } from './dto/avaliacao.dto';
import type { AtorAvaliacao, DecisaoRegistrada, IniciativasPort } from './ports/iniciativas.port';
import { ObterFila } from './use-cases/obter-fila';
import { RegistrarDecisao } from './use-cases/registrar-decisao';

const resumo = (id: string, autorId: string, relevancia = 0): ResumoIniciativa => ({
  id,
  tipo: 'EVENTO',
  titulo: `Iniciativa ${id}`,
  resumo: 'Resumo',
  autor: { id: autorId, nome: `Autor ${autorId}`, perfil: 'ALUNO' },
  status: 'EM_ANALISE',
  comVotacao: true,
  ciclo: 1,
  fimRefinamento: null,
  fimVotacao: null,
  prazoAtual: null,
  votos: { likes: 0, dislikes: 0, relevancia },
  sugestoesCicloAtual: 0,
  inicio: '2026-11-10',
  fim: '2026-11-10',
  periodicidade: 'EVENTO_UNICO',
  espaco: 'Sala 1',
  criadaEm: '2026-10-01T12:00:00.000Z',
  decididaEm: null,
});

class ErroDoDominio extends DomainError {
  readonly code = 'ERRO_TESTE';
  readonly tipo = 'proibido' as const;
}

class IniciativasEmMemoria implements IniciativasPort {
  fila: ResumoIniciativa[] = [];
  decisoes: DecisaoRegistrada[] = [];
  detalhes: Array<{ id: string; ator: AtorAvaliacao }> = [];
  paginas: Array<{ page: number; limit: number }> = [];
  falhaAoDecidir: Error | null = null;

  async listarEmAnalise(page: number, limit: number) {
    this.paginas.push({ page, limit });
    return { items: this.fila, total: this.fila.length };
  }

  async registrarDecisao(decisao: DecisaoRegistrada) {
    if (this.falhaAoDecidir) throw this.falhaAoDecidir;
    this.decisoes.push(decisao);
  }

  async detalhe(id: string, ator: AtorAvaliacao): Promise<DetalheIniciativa> {
    this.detalhes.push({ id, ator });
    return {
      ...resumo(id, 'autor'),
      detalhe: 'd',
      horaInicio: null,
      horaFim: null,
      organizadores: 'o',
      membros: null,
      participantes: 1,
      meuVoto: 0,
      permissoes: {
        podeEditar: false,
        podeComentar: false,
        podeVotar: false,
        podeDecidir: false,
        podeRessubmeter: false,
      },
      decisao: null,
      ultimaJustificativa: null,
      googleAgendaUrl: null,
    };
  }
}

describe('ObterFila (RN-09)', () => {
  it('RN-09.2: repassa a ordem da relevância e consulta Em análise paginado', async () => {
    const iniciativas = new IniciativasEmMemoria();
    iniciativas.fila = [resumo('a', 'x', 0.9), resumo('b', 'y', 0.5), resumo('c', 'z', 0)];
    const resultado = await new ObterFila(iniciativas).executar({
      usuarioId: 'u',
      page: 2,
      limit: 10,
    });
    expect(resultado.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(resultado.total).toBe(3);
    expect(iniciativas.paginas).toEqual([{ page: 2, limit: 10 }]);
  });

  it('RN-09.2: iniciativa sem votação aparece com relevância 0', async () => {
    const iniciativas = new IniciativasEmMemoria();
    iniciativas.fila = [resumo('a', 'x', 0)];
    const { items } = await new ObterFila(iniciativas).executar({
      usuarioId: 'u',
      page: 1,
      limit: 20,
    });
    expect(items[0].votos.relevancia).toBe(0);
  });

  it('RN-09.3: souAutor é verdadeiro só nas iniciativas do usuário logado', async () => {
    const iniciativas = new IniciativasEmMemoria();
    iniciativas.fila = [resumo('a', 'carla'), resumo('b', 'bruno')];
    const { items } = await new ObterFila(iniciativas).executar({
      usuarioId: 'carla',
      page: 1,
      limit: 20,
    });
    expect(items.map((i) => i.souAutor)).toEqual([true, false]);
  });
});

describe('RegistrarDecisao (RN-10)', () => {
  const decisor = { id: 'carla', nome: 'Carla Menezes' };
  let iniciativas: IniciativasEmMemoria;
  let useCase: RegistrarDecisao;

  beforeEach(() => {
    iniciativas = new IniciativasEmMemoria();
    useCase = new RegistrarDecisao(iniciativas);
  });

  it('RN-10.1: aprova sem justificativa e devolve o detalhe como comitê', async () => {
    const detalhe = await useCase.executar({
      iniciativaId: 'i-1',
      resultado: 'APROVADA',
      justificativa: 'ignorada',
      decisor,
    });
    expect(iniciativas.decisoes).toEqual([
      { iniciativaId: 'i-1', resultado: 'APROVADA', justificativa: null, decisorId: 'carla' },
    ]);
    expect(iniciativas.detalhes).toEqual([
      { id: 'i-1', ator: { id: 'carla', nome: 'Carla Menezes', ehComite: true } },
    ]);
    expect(detalhe.id).toBe('i-1');
  });

  it('RN-10.2: reprova com a justificativa aparada', async () => {
    await useCase.executar({
      iniciativaId: 'i-1',
      resultado: 'REPROVADA',
      justificativa: '  Falta orçamento.  ',
      decisor,
    });
    expect(iniciativas.decisoes[0]).toMatchObject({
      resultado: 'REPROVADA',
      justificativa: 'Falta orçamento.',
    });
  });

  it('RN-10.3: reprovar sem justificativa é 422 e não chama iniciativas', async () => {
    const erro = await useCase
      .executar({ iniciativaId: 'i-1', resultado: 'REPROVADA', justificativa: '  ', decisor })
      .catch((e) => e);
    expect(erro).toBeInstanceOf(ValidacaoError);
    expect(erro.campos).toEqual({ justificativa: 'A justificativa é obrigatória para reprovar.' });
    expect(iniciativas.decisoes).toEqual([]);
    expect(iniciativas.detalhes).toEqual([]);
  });

  it('RN-10.4: o erro de autor (403) vindo de iniciativas sobe intacto', async () => {
    const erro = new ErroDoDominio(
      'Você é o autor desta iniciativa e não pode registrar a decisão. Outro membro do comitê deve fazê-lo.',
    );
    iniciativas.falhaAoDecidir = erro;
    await expect(
      useCase.executar({ iniciativaId: 'i-1', resultado: 'APROVADA', decisor }),
    ).rejects.toBe(erro);
    expect(iniciativas.detalhes).toEqual([]);
  });

  it('RN-10.5: o conflito (409) fora de Em análise sobe intacto', async () => {
    const erro = new Error('conflito');
    iniciativas.falhaAoDecidir = erro;
    await expect(
      useCase.executar({
        iniciativaId: 'i-1',
        resultado: 'REPROVADA',
        justificativa: 'x',
        decisor,
      }),
    ).rejects.toBe(erro);
  });
});
