import { FakeClock } from '@/shared/testing/fake-clock';
import type { Comentario } from '../domain/comentario';
import type {
  ComentarioPersistido,
  ComentarioRepository,
  PaginaDeComentarios,
  ParIniciativaCiclo,
} from '../domain/ports/comentario.repository';
import type { AutoresPort, AutorInfo } from './ports/autores.port';
import type { EstadoIniciativa, IniciativaPort } from './ports/iniciativa.port';
import { RefinamentoFacade } from './refinamento.facade';

class ComentarioRepositoryEmMemoria implements ComentarioRepository {
  readonly linhas: ComentarioPersistido[] = [];
  private sequencia = 0;

  async salvar(comentario: Comentario): Promise<ComentarioPersistido> {
    const salvo = { id: `c-${String(++this.sequencia).padStart(4, '0')}`, ...comentario };
    this.linhas.push(salvo);
    return salvo;
  }

  async listarPorIniciativa(
    iniciativaId: string,
    skip: number,
    take: number,
  ): Promise<PaginaDeComentarios> {
    const todos = this.linhas
      .filter((l) => l.iniciativaId === iniciativaId)
      .sort(
        (a, b) =>
          b.ciclo - a.ciclo ||
          a.criadoEm.getTime() - b.criadoEm.getTime() ||
          a.id.localeCompare(b.id),
      );
    return { items: todos.slice(skip, skip + take), total: todos.length };
  }

  async contarPorCiclo(pares: ParIniciativaCiclo[]): Promise<Map<string, number>> {
    const contagens = new Map<string, number>();
    for (const par of pares) {
      const n = this.linhas.filter(
        (l) => l.iniciativaId === par.iniciativaId && l.ciclo === par.ciclo,
      ).length;
      if (n > 0) contagens.set(par.iniciativaId, n);
    }
    return contagens;
  }
}

class IniciativaPortFalsa implements IniciativaPort {
  readonly estados = new Map<string, EstadoIniciativa>();
  async obterEstado(id: string): Promise<EstadoIniciativa | null> {
    return this.estados.get(id) ?? null;
  }
}

class AutoresPortFalso implements AutoresPort {
  readonly autores = new Map<string, AutorInfo>([
    ['u-ana', { id: 'u-ana', nome: 'Ana Souza', perfil: 'ALUNO' }],
    ['u-bruno', { id: 'u-bruno', nome: 'Bruno Lima', perfil: 'PROFESSOR' }],
  ]);
  async mapaPorIds(ids: string[]): Promise<Map<string, AutorInfo>> {
    const mapa = new Map<string, AutorInfo>();
    for (const id of ids) {
      const autor = this.autores.get(id);
      if (autor) mapa.set(id, autor);
    }
    return mapa;
  }
}

describe('RefinamentoFacade', () => {
  let repo: ComentarioRepositoryEmMemoria;
  let iniciativas: IniciativaPortFalsa;
  let clock: FakeClock;
  let facade: RefinamentoFacade;

  const emAndamento = (extra: Partial<EstadoIniciativa> = {}): EstadoIniciativa => ({
    id: 'ini-1',
    autorId: 'u-ana',
    status: 'EM_ANDAMENTO',
    ciclo: 1,
    ...extra,
  });

  beforeEach(() => {
    repo = new ComentarioRepositoryEmMemoria();
    iniciativas = new IniciativaPortFalsa();
    iniciativas.estados.set('ini-1', emAndamento());
    clock = new FakeClock(new Date('2026-11-02T12:00:00Z'));
    facade = new RefinamentoFacade(repo, iniciativas, new AutoresPortFalso(), clock);
  });

  describe('comentar', () => {
    it('RN-05.1: comentário válido é criado com o ciclo atual e o autor exibido', async () => {
      const dto = await facade.comentar({
        iniciativaId: 'ini-1',
        autorId: 'u-bruno',
        texto: '  Sugiro um horário à tarde.  ',
      });
      expect(dto).toEqual({
        id: 'c-0001',
        ciclo: 1,
        autor: {
          id: 'u-bruno',
          nome: 'Bruno Lima',
          perfil: 'PROFESSOR',
          ehAutorDaIniciativa: false,
        },
        texto: 'Sugiro um horário à tarde.',
        criadoEm: '2026-11-02T12:00:00.000Z',
      });
      expect(repo.linhas).toHaveLength(1);
    });

    it('RN-05.1: o autor da iniciativa também pode comentar', async () => {
      const dto = await facade.comentar({
        iniciativaId: 'ini-1',
        autorId: 'u-ana',
        texto: 'Obrigada!',
      });
      expect(dto.autor.ehAutorDaIniciativa).toBe(true);
    });

    it('guarda o ciclo atual da iniciativa', async () => {
      iniciativas.estados.set('ini-1', emAndamento({ ciclo: 3 }));
      const dto = await facade.comentar({ iniciativaId: 'ini-1', autorId: 'u-bruno', texto: 'x' });
      expect(dto.ciclo).toBe(3);
    });

    it('usa valores padrão quando o autor não está no cadastro', async () => {
      const dto = await facade.comentar({ iniciativaId: 'ini-1', autorId: 'u-novo', texto: 'x' });
      expect(dto.autor).toMatchObject({ nome: 'Usuário desconhecido', perfil: 'ALUNO' });
    });

    it('RN-05.2: texto vazio é 422 e nada é gravado', async () => {
      await expect(
        facade.comentar({ iniciativaId: 'ini-1', autorId: 'u-bruno', texto: '   ' }),
      ).rejects.toMatchObject({
        tipo: 'validacao',
        campos: { texto: 'Escreva sua sugestão antes de enviar.' },
      });
      expect(repo.linhas).toHaveLength(0);
    });

    it.each([
      'EM_VOTACAO',
      'EM_ANALISE',
      'APROVADA',
      'REPROVADA',
    ])('RN-05.3: em %s recebe 409 "A fase de sugestões terminou."', async (status) => {
      iniciativas.estados.set('ini-1', emAndamento({ status }));
      await expect(
        facade.comentar({ iniciativaId: 'ini-1', autorId: 'u-bruno', texto: 'oi' }),
      ).rejects.toMatchObject({ tipo: 'conflito', message: 'A fase de sugestões terminou.' });
      expect(repo.linhas).toHaveLength(0);
    });

    it('RN-05.5: com o prazo vencido a porta já devolve o status atualizado, e o comentário recebe 409', async () => {
      // O adaptador de `iniciativas` aplica as transições vencidas antes de responder.
      iniciativas.estados.set('ini-1', emAndamento({ status: 'EM_VOTACAO' }));
      await expect(
        facade.comentar({ iniciativaId: 'ini-1', autorId: 'u-bruno', texto: 'tarde demais' }),
      ).rejects.toMatchObject({ tipo: 'conflito' });
    });

    it('404 se a iniciativa não existe', async () => {
      await expect(
        facade.comentar({ iniciativaId: 'nao-existe', autorId: 'u-bruno', texto: 'oi' }),
      ).rejects.toMatchObject({ tipo: 'nao_encontrado', message: 'Iniciativa não encontrada.' });
    });
  });

  describe('listar', () => {
    const comentarNoCiclo = async (ciclo: number, texto: string, autorId = 'u-bruno') => {
      iniciativas.estados.set('ini-1', emAndamento({ ciclo }));
      const dto = await facade.comentar({ iniciativaId: 'ini-1', autorId, texto });
      clock.advance(60_000);
      return dto;
    };

    it('RN-05.4: comentários do ciclo anterior continuam listados e marcados com o ciclo', async () => {
      await comentarNoCiclo(1, 'primeiro');
      await comentarNoCiclo(1, 'segundo');
      await comentarNoCiclo(2, 'terceiro');
      const pagina = await facade.listar({ iniciativaId: 'ini-1' });
      expect(pagina.items.map((i) => [i.ciclo, i.texto])).toEqual([
        [2, 'terceiro'],
        [1, 'primeiro'],
        [1, 'segundo'],
      ]);
    });

    it('ordena ciclo mais recente primeiro e, dentro do ciclo, do mais antigo para o mais novo', async () => {
      await comentarNoCiclo(1, 'c1-a');
      await comentarNoCiclo(2, 'c2-a');
      await comentarNoCiclo(1, 'c1-b');
      await comentarNoCiclo(2, 'c2-b');
      const { items } = await facade.listar({ iniciativaId: 'ini-1' });
      expect(items.map((i) => i.texto)).toEqual(['c2-a', 'c2-b', 'c1-a', 'c1-b']);
    });

    it('marca o autor da iniciativa e traz nome e perfil', async () => {
      await comentarNoCiclo(1, 'do autor', 'u-ana');
      await comentarNoCiclo(1, 'de outro', 'u-bruno');
      const { items } = await facade.listar({ iniciativaId: 'ini-1' });
      expect(items[0].autor).toEqual({
        id: 'u-ana',
        nome: 'Ana Souza',
        perfil: 'ALUNO',
        ehAutorDaIniciativa: true,
      });
      expect(items[1].autor.ehAutorDaIniciativa).toBe(false);
    });

    it('usa limite padrão 50 e página 1', async () => {
      await comentarNoCiclo(1, 'a');
      const pagina = await facade.listar({ iniciativaId: 'ini-1' });
      expect(pagina.meta).toEqual({ page: 1, limit: 50, total: 1, totalPages: 1 });
    });

    it('pagina com page e limit', async () => {
      for (const texto of ['a', 'b', 'c', 'd', 'e']) await comentarNoCiclo(1, texto);
      const p2 = await facade.listar({ iniciativaId: 'ini-1', page: 2, limit: 2 });
      expect(p2.items.map((i) => i.texto)).toEqual(['c', 'd']);
      expect(p2.meta).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
    });

    it('lista vazia: total 0 e 0 páginas', async () => {
      const pagina = await facade.listar({ iniciativaId: 'ini-1' });
      expect(pagina).toEqual({ items: [], meta: { page: 1, limit: 50, total: 0, totalPages: 0 } });
    });

    it('lista comentários mesmo fora de Em andamento (leitura)', async () => {
      await comentarNoCiclo(1, 'a');
      iniciativas.estados.set('ini-1', emAndamento({ status: 'APROVADA' }));
      expect((await facade.listar({ iniciativaId: 'ini-1' })).items).toHaveLength(1);
    });

    it('404 se a iniciativa não existe', async () => {
      await expect(facade.listar({ iniciativaId: 'x' })).rejects.toMatchObject({
        tipo: 'nao_encontrado',
      });
    });
  });

  describe('contarSugestoes', () => {
    it('conta só o ciclo pedido; ausente = 0', async () => {
      iniciativas.estados.set('ini-2', emAndamento({ id: 'ini-2' }));
      await facade.comentar({ iniciativaId: 'ini-1', autorId: 'u-bruno', texto: 'a' });
      await facade.comentar({ iniciativaId: 'ini-1', autorId: 'u-ana', texto: 'b' });
      iniciativas.estados.set('ini-1', emAndamento({ ciclo: 2 }));
      await facade.comentar({ iniciativaId: 'ini-1', autorId: 'u-ana', texto: 'c' });

      const contagens = await facade.contarSugestoes([
        { iniciativaId: 'ini-1', ciclo: 1 },
        { iniciativaId: 'ini-2', ciclo: 1 },
      ]);
      expect(contagens.get('ini-1')).toBe(2);
      expect(contagens.get('ini-2') ?? 0).toBe(0);

      const ciclo2 = await facade.contarSugestoes([{ iniciativaId: 'ini-1', ciclo: 2 }]);
      expect(ciclo2.get('ini-1')).toBe(1);
    });

    it('sem pares devolve mapa vazio sem consultar o repositório', async () => {
      expect((await facade.contarSugestoes([])).size).toBe(0);
    });
  });
});
