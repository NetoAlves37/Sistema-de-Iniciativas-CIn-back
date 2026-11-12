import {
  dadosValidos,
  PRAZOS_PADRAO,
  umaIniciativa,
} from '@/modules/iniciativas/testing/builders/iniciativa.builder';
import { IniciativaRepositoryEmMemoria } from '@/modules/iniciativas/testing/in-memory/in-memory-iniciativa.repository';
import { ValidacaoError } from '@/shared/domain/domain-error';
import type { DomainEvent } from '@/shared/domain/domain-event';
import { FakeClock } from '@/shared/testing/fake-clock';
import {
  AutorNaoPodeDecidirError,
  ConcorrenciaError,
  IniciativaNaoEncontradaError,
  SomenteAutorError,
  TransicaoInvalidaError,
} from '../../domain/errors/iniciativas.errors';
import type { DadosIniciativaInput } from '../dto/iniciativa.dto';
import type { EventosPort } from '../ports/eventos.port';
import type { TransacaoPort } from '../ports/transacao.port';
import { AplicarPrazosVencidos } from './aplicar-prazos-vencidos';
import { CarregarComPrazos } from './carregar-com-prazos';
import { ComandosIniciativa } from './comandos';

const DIA = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-11-02T12:00:00.000Z');

class EventosEmMemoria implements EventosPort {
  publicados: DomainEvent[] = [];
  publicar(eventos: DomainEvent[]): void {
    this.publicados.push(...eventos);
  }
  nomes(): string[] {
    return this.publicados.map((e) => e.constructor.name);
  }
}

const transacaoSimples: TransacaoPort = { run: (trabalho) => trabalho() };

function montar() {
  const repositorio = new IniciativaRepositoryEmMemoria();
  const clock = new FakeClock(T0);
  const eventos = new EventosEmMemoria();
  const carregar = new CarregarComPrazos(
    repositorio,
    transacaoSimples,
    eventos,
    clock,
    PRAZOS_PADRAO,
  );
  const comandos = new ComandosIniciativa({
    repositorio,
    transacao: transacaoSimples,
    eventos,
    clock,
    prazos: PRAZOS_PADRAO,
    carregar,
  });
  const job = new AplicarPrazosVencidos(repositorio, carregar, clock);
  return { repositorio, clock, eventos, carregar, comandos, job };
}

const entrada = (sobrescritas: Partial<DadosIniciativaInput> = {}): DadosIniciativaInput =>
  ({ ...dadosValidos(), ...sobrescritas }) as DadosIniciativaInput;

describe('SubmeterIniciativa (RN-01 a RN-03)', () => {
  it('RN-03.1: cria em EM_ANDAMENTO, ciclo 1, grava o histórico e publica o evento', async () => {
    const { comandos, repositorio, eventos } = montar();

    const id = await comandos.submeter('ana', entrada());

    const gravada = repositorio.persistida(id);
    expect(gravada).toMatchObject({
      autorId: 'ana',
      status: 'EM_ANDAMENTO',
      ciclo: 1,
      comVotacao: true,
    });
    expect(repositorio.historico).toMatchObject([
      { para: 'EM_ANDAMENTO', por: 'ana', iniciativaId: id },
    ]);
    expect(eventos.nomes()).toEqual(['IniciativaSubmetida']);
  });

  it('RN-03.2: o prazo vem do Clock e da configuração', async () => {
    const { comandos, repositorio } = montar();
    const id = await comandos.submeter('ana', entrada());
    expect(repositorio.persistida(id).fimRefinamento?.getTime()).toBe(T0.getTime() + 3 * DIA);
  });

  it('RN-03.3: comVotacao=false é persistido; omitido, o padrão é true', async () => {
    const { comandos, repositorio } = montar();
    const sem = await comandos.submeter('ana', entrada({ comVotacao: false }));
    const padrao = await comandos.submeter('ana', entrada());
    expect(repositorio.persistida(sem).comVotacao).toBe(false);
    expect(repositorio.persistida(padrao).comVotacao).toBe(true);
  });

  it('RN-01: dados inválidos lançam ValidacaoError com os campos e nada é gravado', async () => {
    const { comandos, repositorio } = montar();
    await expect(
      comandos.submeter('ana', entrada({ titulo: '', participantes: 0 })),
    ).rejects.toMatchObject({
      campos: { titulo: 'Informe o título.', participantes: 'Informe um número maior que zero.' },
    });
    await expect(comandos.submeter('ana', entrada({ titulo: '' }))).rejects.toBeInstanceOf(
      ValidacaoError,
    );
    expect(repositorio.historico).toEqual([]);
  });
});

describe('EditarIniciativa (RN-04)', () => {
  it('RN-04.1: o autor edita em EM_ANDAMENTO e o histórico registra a edição', async () => {
    const { comandos, repositorio, eventos } = montar();
    const base = umaIniciativa()
      .doAutor('ana')
      .comPrazos(new Date(T0.getTime() + DIA), null)
      .construir();
    repositorio.semear(base);

    await comandos.editar(base.id, 'ana', entrada({ titulo: 'Novo título', comVotacao: false }));

    const gravada = repositorio.persistida(base.id);
    expect(gravada.dados.titulo).toBe('Novo título');
    expect(gravada.comVotacao).toBe(false);
    expect(gravada.version).toBe(1);
    expect(repositorio.historico.at(-1)).toMatchObject({
      de: 'EM_ANDAMENTO',
      para: 'EM_ANDAMENTO',
      nota: 'Iniciativa editada durante o refinamento',
    });
    expect(eventos.nomes()).toContain('IniciativaEditada');
  });

  it('RN-04.1: sem comVotacao no corpo, mantém o valor atual', async () => {
    const { comandos, repositorio } = montar();
    const base = umaIniciativa()
      .doAutor('ana')
      .semVotacao()
      .comPrazos(new Date(T0.getTime() + DIA), null)
      .construir();
    repositorio.semear(base);
    await comandos.editar(base.id, 'ana', entrada());
    expect(repositorio.persistida(base.id).comVotacao).toBe(false);
  });

  it('RN-04.2: quem não é o autor recebe 403', async () => {
    const { comandos, repositorio } = montar();
    const base = umaIniciativa()
      .doAutor('ana')
      .comPrazos(new Date(T0.getTime() + DIA), null)
      .construir();
    repositorio.semear(base);
    await expect(comandos.editar(base.id, 'bruno', entrada())).rejects.toBeInstanceOf(
      SomenteAutorError,
    );
  });

  it('RN-04.3: fora de EM_ANDAMENTO recebe 409', async () => {
    const { comandos, repositorio } = montar();
    const base = umaIniciativa().doAutor('ana').emAnalise().construir();
    repositorio.semear(base);
    await expect(comandos.editar(base.id, 'ana', entrada())).rejects.toBeInstanceOf(
      TransicaoInvalidaError,
    );
  });

  it('RN-04.4: com o prazo vencido e o job sem rodar, recebe 409 e a transição JÁ FICA aplicada', async () => {
    const { comandos, repositorio, clock } = montar();
    const base = umaIniciativa()
      .doAutor('ana')
      .comPrazos(new Date(T0.getTime() + DIA), null)
      .construir();
    repositorio.semear(base);
    clock.advance(2 * DIA);

    await expect(comandos.editar(base.id, 'ana', entrada())).rejects.toThrow(
      'Iniciativas com status "Em votação" não podem ser editadas.',
    );

    expect(repositorio.persistida(base.id).status).toBe('EM_VOTACAO');
    expect(repositorio.historico.map((h) => h.para)).toEqual(['EM_VOTACAO']);
  });

  it('iniciativa inexistente: 404', async () => {
    const { comandos } = montar();
    await expect(comandos.editar('nao-existe', 'ana', entrada())).rejects.toBeInstanceOf(
      IniciativaNaoEncontradaError,
    );
  });

  it('RN-01 vale na edição: dados inválidos recebem 422 e nada muda', async () => {
    const { comandos, repositorio } = montar();
    const base = umaIniciativa()
      .doAutor('ana')
      .comPrazos(new Date(T0.getTime() + DIA), null)
      .construir();
    repositorio.semear(base);
    await expect(
      comandos.editar(base.id, 'ana', entrada({ fim: '2020-01-01' })),
    ).rejects.toBeInstanceOf(ValidacaoError);
    expect(repositorio.persistida(base.id).version).toBe(0);
  });
});

describe('RessubmeterIniciativa (RN-11)', () => {
  it('RN-11.1: reabre o refinamento no ciclo seguinte, com a justificativa anterior no histórico', async () => {
    const { comandos, repositorio, eventos } = montar();
    const base = umaIniciativa().doAutor('ana').reprovada('Ajustar o espaço.').construir();
    repositorio.semear(base);

    await comandos.ressubmeter(base.id, 'ana', entrada({ titulo: 'Revisado', comVotacao: false }));

    const gravada = repositorio.persistida(base.id);
    expect(gravada).toMatchObject({
      status: 'EM_ANDAMENTO',
      ciclo: 2,
      comVotacao: false,
      fimVotacao: null,
      decisorId: null,
      justificativa: null,
    });
    expect(gravada.dados.titulo).toBe('Revisado');
    expect(gravada.fimRefinamento?.getTime()).toBe(T0.getTime() + 3 * DIA);
    expect(repositorio.historico.at(-1)).toMatchObject({
      nota: 'Ressubmetida após reprovação (ciclo 2)',
    });
    expect(eventos.nomes()).toContain('IniciativaRessubmetida');
  });

  it('RN-11.2 e RN-11.3: 403 para outro usuário e 409 fora de REPROVADA', async () => {
    const { comandos, repositorio } = montar();
    const reprovada = umaIniciativa().comId('r1').doAutor('ana').reprovada().construir();
    const aprovada = umaIniciativa().comId('a1').doAutor('ana').aprovada().construir();
    repositorio.semear(reprovada);
    repositorio.semear(aprovada);
    await expect(comandos.ressubmeter('r1', 'bruno', entrada())).rejects.toBeInstanceOf(
      SomenteAutorError,
    );
    await expect(comandos.ressubmeter('a1', 'ana', entrada())).rejects.toBeInstanceOf(
      TransicaoInvalidaError,
    );
  });
});

describe('RegistrarDecisao (RN-10)', () => {
  it('RN-10.1 e RN-10.2: aprova e reprova (com justificativa), e publica IniciativaDecidida', async () => {
    const { comandos, repositorio, eventos } = montar();
    repositorio.semear(umaIniciativa().comId('i1').doAutor('ana').emAnalise().construir());
    repositorio.semear(umaIniciativa().comId('i2').doAutor('ana').emAnalise().construir());

    await comandos.decidir('i1', 'carla', 'APROVADA', undefined);
    await comandos.decidir('i2', 'elisa', 'REPROVADA', 'Sem espaço disponível.');

    expect(repositorio.persistida('i1')).toMatchObject({ status: 'APROVADA', decisorId: 'carla' });
    expect(repositorio.persistida('i2')).toMatchObject({
      status: 'REPROVADA',
      justificativa: 'Sem espaço disponível.',
    });
    expect(eventos.nomes().filter((n) => n === 'IniciativaDecidida')).toHaveLength(2);
  });

  it('RN-10.4: o autor recebe 403', async () => {
    const { comandos, repositorio } = montar();
    repositorio.semear(umaIniciativa().comId('i1').doAutor('carla').emAnalise().construir());
    await expect(comandos.decidir('i1', 'carla', 'APROVADA', undefined)).rejects.toBeInstanceOf(
      AutorNaoPodeDecidirError,
    );
  });

  it('RN-10.5: fora de EM_ANALISE recebe 409', async () => {
    const { comandos, repositorio } = montar();
    repositorio.semear(umaIniciativa().comId('i1').doAutor('ana').construir());
    await expect(comandos.decidir('i1', 'carla', 'APROVADA', undefined)).rejects.toBeInstanceOf(
      TransicaoInvalidaError,
    );
  });

  it('RN-10.6 (versão): a decisão concorrente que perde a corrida recebe 409 "já foi decidida"', async () => {
    const { comandos, repositorio } = montar();
    repositorio.semear(umaIniciativa().comId('i1').doAutor('ana').emAnalise().construir());
    // Simula o outro membro do comitê gravando entre a leitura e a escrita.
    const original = repositorio.salvar.bind(repositorio);
    let primeira = true;
    repositorio.salvar = async (iniciativa) => {
      if (primeira) {
        primeira = false;
        const concorrente = await repositorio.buscarPorId('i1');
        concorrente?.decidir('APROVADA', undefined, 'elisa', new FakeClock(T0));
        if (concorrente) await original(concorrente);
      }
      return original(iniciativa);
    };

    const tentativa = comandos.decidir('i1', 'carla', 'REPROVADA', 'x');

    await expect(tentativa).rejects.toBeInstanceOf(ConcorrenciaError);
    await expect(tentativa).rejects.toThrow('Esta iniciativa já foi decidida.');
    expect(repositorio.persistida('i1')).toMatchObject({ status: 'APROVADA', decisorId: 'elisa' });
  });

  it('iniciativa inexistente: 404', async () => {
    const { comandos } = montar();
    await expect(comandos.decidir('x', 'carla', 'APROVADA', undefined)).rejects.toBeInstanceOf(
      IniciativaNaoEncontradaError,
    );
  });
});

describe('CarregarComPrazos e job (RN-06)', () => {
  it('aplica a transição vencida, grava o histórico com o prazo vencido e publica os eventos', async () => {
    const { carregar, repositorio, clock, eventos } = montar();
    const fimRef = new Date(T0.getTime() + DIA);
    repositorio.semear(umaIniciativa().comId('i1').comPrazos(fimRef, null).construir());
    clock.advance(10 * DIA);

    const iniciativa = await carregar.executar('i1');

    expect(iniciativa?.status).toBe('EM_ANALISE');
    expect(repositorio.historico.map((h) => [h.de, h.para, h.por])).toEqual([
      ['EM_ANDAMENTO', 'EM_VOTACAO', 'SISTEMA'],
      ['EM_VOTACAO', 'EM_ANALISE', 'SISTEMA'],
    ]);
    expect(repositorio.historico[0].ocorreuEm).toEqual(fimRef);
    expect(eventos.nomes()).toEqual(['RefinamentoEncerrado', 'VotacaoEncerrada']);
  });

  it('não grava nada quando não há prazo vencido', async () => {
    const { carregar, repositorio } = montar();
    repositorio.semear(
      umaIniciativa()
        .comId('i1')
        .comPrazos(new Date(T0.getTime() + DIA), null)
        .construir(),
    );
    await carregar.executar('i1');
    expect(repositorio.salvamentos).toBe(0);
  });

  it('devolve null quando a iniciativa não existe', async () => {
    const { carregar } = montar();
    expect(await carregar.executar('x')).toBeNull();
  });

  it('refaz a leitura quando perde a corrida de gravação (concorrência), sem duplicar histórico', async () => {
    const { carregar, repositorio, clock } = montar();
    repositorio.semear(
      umaIniciativa()
        .comId('i1')
        .comPrazos(new Date(T0.getTime() + DIA), null)
        .construir(),
    );
    clock.advance(2 * DIA);
    const original = repositorio.salvar.bind(repositorio);
    let primeira = true;
    repositorio.salvar = async (iniciativa) => {
      if (primeira) {
        primeira = false;
        // Outra instância aplica a mesma transição antes.
        const outra = await repositorio.buscarPorId('i1');
        outra?.aplicarPrazosVencidos(clock, PRAZOS_PADRAO);
        if (outra) await original(outra);
      }
      return original(iniciativa);
    };

    const iniciativa = await carregar.executar('i1');

    expect(iniciativa?.status).toBe('EM_VOTACAO');
    expect(repositorio.historico.filter((h) => h.para === 'EM_VOTACAO')).toHaveLength(1);
  });

  it('RN-06.6 (versão): o job é idempotente e processa várias iniciativas', async () => {
    const { job, repositorio, clock } = montar();
    repositorio.semear(
      umaIniciativa()
        .comId('i1')
        .comPrazos(new Date(T0.getTime() + DIA), null)
        .construir(),
    );
    repositorio.semear(
      umaIniciativa()
        .comId('i2')
        .semVotacao()
        .comPrazos(new Date(T0.getTime() + DIA), null)
        .construir(),
    );
    repositorio.semear(
      umaIniciativa()
        .comId('i3')
        .comPrazos(new Date(T0.getTime() + 9 * DIA), null)
        .construir(),
    );
    clock.advance(2 * DIA);

    expect(await job.executar()).toBe(2);
    expect(await job.executar()).toBe(0);

    expect(repositorio.persistida('i1').status).toBe('EM_VOTACAO');
    expect(repositorio.persistida('i2').status).toBe('EM_ANALISE');
    expect(repositorio.persistida('i3').status).toBe('EM_ANDAMENTO');
    expect(repositorio.historico).toHaveLength(2);
  });

  it('o job ignora ConcorrenciaError (outra instância já processou) e propaga os demais erros', async () => {
    const { job, repositorio, clock, carregar } = montar();
    repositorio.semear(
      umaIniciativa()
        .comId('i1')
        .comPrazos(new Date(T0.getTime() + DIA), null)
        .construir(),
    );
    clock.advance(2 * DIA);

    const original = carregar.executar.bind(carregar);
    carregar.executar = async () => {
      throw new ConcorrenciaError();
    };
    await expect(job.executar()).resolves.toBe(0);

    carregar.executar = async () => {
      throw new Error('falha inesperada');
    };
    await expect(job.executar()).rejects.toThrow('falha inesperada');
    carregar.executar = original;
  });
});
