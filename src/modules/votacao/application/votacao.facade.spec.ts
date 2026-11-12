import type { TransacaoPort } from '@/shared/domain/transacao.port';
import type {
  ParIniciativaCiclo,
  Placar,
  VotacaoRepository,
} from '../domain/ports/votacao.repository';
import { wilson } from '../domain/relevancia';
import type { MeuVoto, ValorVoto } from '../domain/voto';
import type { EstadoIniciativa, IniciativaPort } from './ports/iniciativa.port';
import { VotacaoFacade } from './votacao.facade';

const chave = (iniciativaId: string, ciclo: number) => `${iniciativaId}#${ciclo}`;

class VotacaoRepositoryEmMemoria implements VotacaoRepository {
  readonly votos = new Map<string, ValorVoto>();
  readonly placares = new Map<string, Placar>();
  readonly chamadas: string[] = [];

  async garantirPlacar(iniciativaId: string, ciclo: number): Promise<void> {
    this.chamadas.push('garantir');
    const k = chave(iniciativaId, ciclo);
    if (!this.placares.has(k)) this.placares.set(k, { likes: 0, dislikes: 0, relevancia: 0 });
  }

  async travarPlacar(): Promise<void> {
    this.chamadas.push('travar');
  }

  async buscarVoto(iniciativaId: string, ciclo: number, usuarioId: string): Promise<MeuVoto> {
    return this.votos.get(`${chave(iniciativaId, ciclo)}#${usuarioId}`) ?? 0;
  }

  async gravarVoto(iniciativaId: string, ciclo: number, usuarioId: string, valor: ValorVoto) {
    this.votos.set(`${chave(iniciativaId, ciclo)}#${usuarioId}`, valor);
  }

  async removerVoto(iniciativaId: string, ciclo: number, usuarioId: string): Promise<void> {
    this.votos.delete(`${chave(iniciativaId, ciclo)}#${usuarioId}`);
  }

  async contarVotos(iniciativaId: string, ciclo: number) {
    let likes = 0;
    let dislikes = 0;
    for (const [k, valor] of this.votos) {
      if (!k.startsWith(`${chave(iniciativaId, ciclo)}#`)) continue;
      if (valor === 1) likes++;
      else dislikes++;
    }
    return { likes, dislikes };
  }

  async salvarPlacar(iniciativaId: string, ciclo: number, placar: Placar): Promise<void> {
    this.placares.set(chave(iniciativaId, ciclo), placar);
  }

  async buscarPlacar(iniciativaId: string, ciclo: number): Promise<Placar | null> {
    return this.placares.get(chave(iniciativaId, ciclo)) ?? null;
  }

  async buscarPlacares(pares: ParIniciativaCiclo[]): Promise<Map<string, Placar>> {
    const mapa = new Map<string, Placar>();
    for (const par of pares) {
      const placar = this.placares.get(chave(par.iniciativaId, par.ciclo));
      if (placar) mapa.set(par.iniciativaId, placar);
    }
    return mapa;
  }
}

class IniciativaPortFalsa implements IniciativaPort {
  readonly estados = new Map<string, EstadoIniciativa>();
  async obterEstado(id: string): Promise<EstadoIniciativa | null> {
    return this.estados.get(id) ?? null;
  }
}

class TransacaoFalsa implements TransacaoPort {
  execucoes = 0;
  async run<T>(trabalho: () => Promise<T>): Promise<T> {
    this.execucoes++;
    return trabalho();
  }
}

describe('VotacaoFacade', () => {
  let repo: VotacaoRepositoryEmMemoria;
  let iniciativas: IniciativaPortFalsa;
  let transacao: TransacaoFalsa;
  let facade: VotacaoFacade;

  const emVotacao = (extra: Partial<EstadoIniciativa> = {}): EstadoIniciativa => ({
    id: 'ini-1',
    autorId: 'u-ana',
    status: 'EM_VOTACAO',
    ciclo: 1,
    ...extra,
  });
  const votar = (usuarioId: string, valor: number, iniciativaId = 'ini-1') =>
    facade.votar({ iniciativaId, usuarioId, valor });

  beforeEach(() => {
    repo = new VotacaoRepositoryEmMemoria();
    iniciativas = new IniciativaPortFalsa();
    iniciativas.estados.set('ini-1', emVotacao());
    transacao = new TransacaoFalsa();
    facade = new VotacaoFacade(repo, iniciativas, transacao);
  });

  describe('votar', () => {
    it('RN-07.1: registra um voto e devolve o placar com a relevância de Wilson', async () => {
      const resultado = await votar('u-diego', 1);
      expect(resultado).toEqual({
        meuVoto: 1,
        likes: 1,
        dislikes: 0,
        relevancia: wilson(1, 1),
        acao: 'REGISTRADO',
      });
      expect(resultado.relevancia).toBeGreaterThan(0);
    });

    it('RN-07.2: trocar o voto move o voto de likes para dislikes', async () => {
      await votar('u-diego', 1);
      const resultado = await votar('u-diego', -1);
      expect(resultado).toMatchObject({ meuVoto: -1, likes: 0, dislikes: 1, acao: 'ALTERADO' });
      expect(resultado.relevancia).toBe(wilson(0, 1));
    });

    it('RN-07.3: clicar no mesmo voto retira o voto', async () => {
      await votar('u-diego', 1);
      const resultado = await votar('u-diego', 1);
      expect(resultado).toEqual({
        meuVoto: 0,
        likes: 0,
        dislikes: 0,
        relevancia: 0,
        acao: 'RETIRADO',
      });
      expect(repo.votos.size).toBe(0);
    });

    it('RN-07.3: retirar um dislike também funciona', async () => {
      await votar('u-diego', -1);
      expect(await votar('u-diego', -1)).toMatchObject({ meuVoto: 0, acao: 'RETIRADO' });
    });

    it('RN-07.4: o autor da iniciativa pode votar', async () => {
      const resultado = await votar('u-ana', 1);
      expect(resultado).toMatchObject({ meuVoto: 1, likes: 1, acao: 'REGISTRADO' });
    });

    it('mantém likes e dislikes de vários usuários e a relevância consistente', async () => {
      await votar('u-1', 1);
      await votar('u-2', 1);
      await votar('u-3', 1);
      const resultado = await votar('u-4', -1);
      expect(resultado).toMatchObject({ likes: 3, dislikes: 1 });
      expect(resultado.relevancia).toBe(wilson(3, 4));
      expect(repo.placares.get('ini-1#1')).toEqual({
        likes: 3,
        dislikes: 1,
        relevancia: wilson(3, 4),
      });
    });

    it('garante e trava o placar dentro de uma transação antes de contar', async () => {
      await votar('u-diego', 1);
      expect(transacao.execucoes).toBe(1);
      expect(repo.chamadas).toEqual(['garantir', 'travar']);
    });

    it.each([
      'EM_ANDAMENTO',
      'EM_ANALISE',
      'APROVADA',
      'REPROVADA',
    ])('RN-07.5: em %s recebe 409 "A votação desta iniciativa foi encerrada."', async (status) => {
      iniciativas.estados.set('ini-1', emVotacao({ status }));
      await expect(votar('u-diego', 1)).rejects.toMatchObject({
        tipo: 'conflito',
        message: 'A votação desta iniciativa foi encerrada.',
      });
      expect(repo.votos.size).toBe(0);
      expect(transacao.execucoes).toBe(0);
    });

    it('RN-07.5: iniciativa sem votação nunca está em EM_VOTACAO e recebe 409 pelo mesmo caminho', async () => {
      // `comVotacao=false` vai direto para EM_ANALISE (RN-06.2).
      iniciativas.estados.set('ini-1', emVotacao({ status: 'EM_ANALISE' }));
      await expect(votar('u-diego', -1)).rejects.toMatchObject({ code: 'VOTACAO_ENCERRADA' });
    });

    it('404 se a iniciativa não existe', async () => {
      await expect(votar('u-diego', 1, 'nao-existe')).rejects.toMatchObject({
        tipo: 'nao_encontrado',
      });
    });

    it.each([0, 2, -2, 0.5])('422 se o valor %s é inválido', async (valor) => {
      await expect(votar('u-diego', valor)).rejects.toMatchObject({
        tipo: 'validacao',
        campos: { valor: expect.any(String) },
      });
      expect(repo.votos.size).toBe(0);
    });

    it('RN-07.7: o voto de um ciclo não aparece no seguinte', async () => {
      await votar('u-diego', 1);
      iniciativas.estados.set('ini-1', emVotacao({ ciclo: 2 }));

      expect(await facade.meuVoto('ini-1', 2, 'u-diego')).toBe(0);
      expect(await facade.placar('ini-1', 2)).toEqual({ likes: 0, dislikes: 0, relevancia: 0 });

      const resultado = await votar('u-diego', 1);
      expect(resultado).toMatchObject({ meuVoto: 1, likes: 1, acao: 'REGISTRADO' });
      // O ciclo 1 não foi tocado.
      expect(await facade.placar('ini-1', 1)).toMatchObject({ likes: 1, dislikes: 0 });
      expect(await facade.placar('ini-1', 2)).toMatchObject({ likes: 1, dislikes: 0 });
    });
  });

  describe('consultas', () => {
    it('placar devolve zeros quando não há linha', async () => {
      expect(await facade.placar('ini-1', 1)).toEqual({ likes: 0, dislikes: 0, relevancia: 0 });
    });

    it('placar devolve o valor gravado pelos votos', async () => {
      await votar('u-1', 1);
      await votar('u-2', -1);
      expect(await facade.placar('ini-1', 1)).toEqual({
        likes: 1,
        dislikes: 1,
        relevancia: wilson(1, 2),
      });
    });

    it('meuVoto devolve 1, -1 ou 0', async () => {
      expect(await facade.meuVoto('ini-1', 1, 'u-1')).toBe(0);
      await votar('u-1', 1);
      await votar('u-2', -1);
      expect(await facade.meuVoto('ini-1', 1, 'u-1')).toBe(1);
      expect(await facade.meuVoto('ini-1', 1, 'u-2')).toBe(-1);
    });

    it('placares em lote: ausente = sem votos; sem pares devolve mapa vazio', async () => {
      await votar('u-1', 1);
      const mapa = await facade.placares([
        { iniciativaId: 'ini-1', ciclo: 1 },
        { iniciativaId: 'ini-2', ciclo: 1 },
      ]);
      expect(mapa.get('ini-1')).toMatchObject({ likes: 1 });
      expect(mapa.has('ini-2')).toBe(false);
      expect((await facade.placares([])).size).toBe(0);
    });
  });
});
