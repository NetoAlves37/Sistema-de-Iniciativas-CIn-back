import {
  AUTOR_PADRAO,
  dadosDeTeste,
  PRAZOS_PADRAO,
  umaIniciativa,
} from '@/modules/iniciativas/testing/builders/iniciativa.builder';
import { FakeClock } from '@/shared/testing/fake-clock';
import {
  AutorNaoPodeDecidirError,
  SomenteAutorError,
  TransicaoInvalidaError,
} from './errors/iniciativas.errors';
import { Iniciativa } from './iniciativa';
import { STATUS_INICIATIVA, type StatusIniciativa } from './status';

const DIA = 24 * 60 * 60 * 1000;
const T0 = new Date('2026-11-02T12:00:00.000Z');

const clockEm = (data: Date = T0) => new FakeClock(data);

describe('Iniciativa: RN-03 (submissão)', () => {
  it('RN-03.1: nasce em EM_ANDAMENTO, ciclo 1, com o histórico inicial', () => {
    const iniciativa = Iniciativa.submeter(dadosDeTeste(), 'ana', true, clockEm(), PRAZOS_PADRAO);

    expect(iniciativa.status).toBe('EM_ANDAMENTO');
    expect(iniciativa.ciclo).toBe(1);
    expect(iniciativa.autorId).toBe('ana');
    expect(iniciativa.fimVotacao).toBeNull();
    expect(iniciativa.version).toBe(0);
    expect(iniciativa.nova).toBe(true);
    expect(iniciativa.novasTransicoes()).toEqual([
      {
        de: null,
        para: 'EM_ANDAMENTO',
        por: 'ana',
        nota: 'Submetida e aberta a sugestões',
        justificativa: null,
        ocorreuEm: T0,
        ciclo: 1,
      },
    ]);
    expect(iniciativa.pullEvents().map((e) => e.constructor.name)).toEqual(['IniciativaSubmetida']);
  });

  it('RN-03.2: o prazo de refinamento usa o Clock e a configuração', () => {
    const iniciativa = Iniciativa.submeter(dadosDeTeste(), 'ana', true, clockEm(), {
      refinamentoDias: 2.5,
      votacaoDias: 3,
    });
    expect(iniciativa.fimRefinamento?.getTime()).toBe(T0.getTime() + 2.5 * DIA);
    expect(iniciativa.criadaEm).toEqual(T0);
  });

  it('RN-03.3: comVotacao=false é guardado', () => {
    const iniciativa = Iniciativa.submeter(dadosDeTeste(), 'ana', false, clockEm(), PRAZOS_PADRAO);
    expect(iniciativa.comVotacao).toBe(false);
  });
});

describe('Iniciativa: RN-04 (edição)', () => {
  it('RN-04.1: o autor edita em EM_ANDAMENTO, inclusive comVotacao, e fica no histórico', () => {
    const iniciativa = umaIniciativa().doAutor('ana').construir();
    const novos = dadosDeTeste({ titulo: 'Novo título' });

    iniciativa.editar(novos, false, 'ana', clockEm());

    expect(iniciativa.dados.titulo).toBe('Novo título');
    expect(iniciativa.comVotacao).toBe(false);
    expect(iniciativa.status).toBe('EM_ANDAMENTO');
    expect(iniciativa.novasTransicoes()).toMatchObject([
      {
        de: 'EM_ANDAMENTO',
        para: 'EM_ANDAMENTO',
        por: 'ana',
        nota: 'Iniciativa editada durante o refinamento',
      },
    ]);
    expect(iniciativa.pullEvents().map((e) => e.constructor.name)).toEqual(['IniciativaEditada']);
  });

  it('RN-04.2: quem não é o autor recebe 403', () => {
    const iniciativa = umaIniciativa().doAutor('ana').construir();
    expect(() => iniciativa.editar(dadosDeTeste(), true, 'bruno', clockEm())).toThrow(
      SomenteAutorError,
    );
  });

  it.each([
    'EM_VOTACAO',
    'EM_ANALISE',
    'APROVADA',
    'REPROVADA',
  ] as const)('RN-04.3: em %s recebe 409 com a mensagem do status', (status) => {
    const iniciativa = umaIniciativa().doAutor('ana').noStatus(status).construir();
    expect(() => iniciativa.editar(dadosDeTeste(), true, 'ana', clockEm())).toThrow(
      /^Iniciativas com status ".+" não podem ser editadas\.$/,
    );
  });
});

describe('Iniciativa: RN-06 (transições por prazo)', () => {
  const fimRef = new Date('2026-11-05T12:00:00.000Z');

  it('RN-06.1: com votação, EM_ANDAMENTO vai para EM_VOTACAO com o fimVotacao correto', () => {
    const iniciativa = umaIniciativa().comPrazos(fimRef, null).construir();

    const transicoes = iniciativa.aplicarPrazosVencidos(
      clockEm(new Date(fimRef.getTime() + 1000)),
      PRAZOS_PADRAO,
    );

    expect(iniciativa.status).toBe('EM_VOTACAO');
    expect(iniciativa.fimVotacao?.getTime()).toBe(fimRef.getTime() + 3 * DIA);
    expect(transicoes).toHaveLength(1);
    expect(transicoes[0]).toMatchObject({
      de: 'EM_ANDAMENTO',
      para: 'EM_VOTACAO',
      por: 'SISTEMA',
      nota: 'Prazo de refinamento encerrado',
    });
  });

  it('RN-06.2: sem votação, EM_ANDAMENTO vai direto para EM_ANALISE', () => {
    const iniciativa = umaIniciativa().semVotacao().comPrazos(fimRef, null).construir();

    iniciativa.aplicarPrazosVencidos(clockEm(new Date(fimRef.getTime() + 1000)), PRAZOS_PADRAO);

    expect(iniciativa.status).toBe('EM_ANALISE');
    expect(iniciativa.fimVotacao).toBeNull();
    expect(iniciativa.novasTransicoes().map((t) => t.para)).toEqual(['EM_ANALISE']);
    expect(iniciativa.novasTransicoes()[0].nota).toBe('Prazo de refinamento encerrado');
  });

  it('RN-06.3: EM_VOTACAO vai para EM_ANALISE no fim da votação', () => {
    const fimVot = new Date('2026-11-08T12:00:00.000Z');
    const iniciativa = umaIniciativa().emVotacao().comPrazos(fimRef, fimVot).construir();

    iniciativa.aplicarPrazosVencidos(clockEm(fimVot), PRAZOS_PADRAO);

    expect(iniciativa.status).toBe('EM_ANALISE');
    expect(iniciativa.novasTransicoes()[0]).toMatchObject({
      de: 'EM_VOTACAO',
      para: 'EM_ANALISE',
      por: 'SISTEMA',
      nota: 'Prazo de votação encerrado',
    });
  });

  it('RN-06.4: antes do prazo nada muda', () => {
    const iniciativa = umaIniciativa().comPrazos(fimRef, null).construir();

    const transicoes = iniciativa.aplicarPrazosVencidos(
      clockEm(new Date(fimRef.getTime() - 1)),
      PRAZOS_PADRAO,
    );

    expect(transicoes).toEqual([]);
    expect(iniciativa.status).toBe('EM_ANDAMENTO');
  });

  it('RN-06.5: vencida há muito tempo, passa pelas duas transições na mesma chamada', () => {
    const iniciativa = umaIniciativa().comPrazos(fimRef, null).construir();

    const transicoes = iniciativa.aplicarPrazosVencidos(
      clockEm(new Date('2027-01-01T00:00:00Z')),
      PRAZOS_PADRAO,
    );

    expect(iniciativa.status).toBe('EM_ANALISE');
    expect(transicoes.map((t) => [t.de, t.para])).toEqual([
      ['EM_ANDAMENTO', 'EM_VOTACAO'],
      ['EM_VOTACAO', 'EM_ANALISE'],
    ]);
  });

  it('RN-06.7: ocorreuEm é o prazo vencido, não o instante da execução', () => {
    const iniciativa = umaIniciativa().comPrazos(fimRef, null).construir();

    const transicoes = iniciativa.aplicarPrazosVencidos(
      clockEm(new Date('2027-01-01T00:00:00Z')),
      PRAZOS_PADRAO,
    );

    expect(transicoes[0].ocorreuEm).toEqual(fimRef);
    expect(transicoes[1].ocorreuEm.getTime()).toBe(fimRef.getTime() + 3 * DIA);
  });

  it('é idempotente: aplicar de novo não gera entradas', () => {
    const iniciativa = umaIniciativa().comPrazos(fimRef, null).construir();
    const clock = clockEm(new Date('2027-01-01T00:00:00Z'));

    iniciativa.aplicarPrazosVencidos(clock, PRAZOS_PADRAO);
    const segunda = iniciativa.aplicarPrazosVencidos(clock, PRAZOS_PADRAO);

    expect(segunda).toEqual([]);
    expect(iniciativa.novasTransicoes()).toHaveLength(2);
  });

  it('não mexe em iniciativas decididas', () => {
    const iniciativa = umaIniciativa().aprovada().construir();
    expect(
      iniciativa.aplicarPrazosVencidos(clockEm(new Date('2030-01-01')), PRAZOS_PADRAO),
    ).toEqual([]);
  });

  it('publica os eventos RefinamentoEncerrado e VotacaoEncerrada', () => {
    const iniciativa = umaIniciativa().comPrazos(fimRef, null).construir();
    iniciativa.aplicarPrazosVencidos(clockEm(new Date('2027-01-01T00:00:00Z')), PRAZOS_PADRAO);
    expect(iniciativa.pullEvents().map((e) => e.constructor.name)).toEqual([
      'RefinamentoEncerrado',
      'VotacaoEncerrada',
    ]);
    expect(iniciativa.pullEvents()).toEqual([]);
  });
});

describe('Iniciativa: RN-10 (decisão)', () => {
  it('RN-10.1: aprova, registrando decisor, data e histórico', () => {
    const iniciativa = umaIniciativa().doAutor('ana').emAnalise().construir();

    iniciativa.decidir('APROVADA', undefined, 'carla', clockEm());

    expect(iniciativa.status).toBe('APROVADA');
    expect(iniciativa.decisorId).toBe('carla');
    expect(iniciativa.decididaEm).toEqual(T0);
    expect(iniciativa.justificativa).toBeNull();
    expect(iniciativa.novasTransicoes()[0]).toMatchObject({
      de: 'EM_ANALISE',
      para: 'APROVADA',
      por: 'carla',
      nota: 'Aprovada pelo comitê',
      justificativa: null,
    });
  });

  it('RN-10.2: reprova com justificativa, que fica na iniciativa e no histórico', () => {
    const iniciativa = umaIniciativa().doAutor('ana').emAnalise().construir();

    iniciativa.decidir('REPROVADA', '  Coincide com a semana de provas.  ', 'carla', clockEm());

    expect(iniciativa.status).toBe('REPROVADA');
    expect(iniciativa.justificativa).toBe('Coincide com a semana de provas.');
    expect(iniciativa.novasTransicoes()[0]).toMatchObject({
      nota: 'Reprovada pelo comitê',
      justificativa: 'Coincide com a semana de provas.',
    });
    expect(iniciativa.pullEvents()[0]).toMatchObject({
      resultado: 'REPROVADA',
      decisorId: 'carla',
    });
  });

  it('RN-10.4: o autor não decide a própria iniciativa (403), mesmo sendo do comitê', () => {
    const iniciativa = umaIniciativa().doAutor('carla').emAnalise().construir();

    expect(() => iniciativa.decidir('APROVADA', undefined, 'carla', clockEm())).toThrow(
      AutorNaoPodeDecidirError,
    );
    expect(iniciativa.status).toBe('EM_ANALISE');
  });

  it.each([
    'EM_ANDAMENTO',
    'EM_VOTACAO',
    'APROVADA',
    'REPROVADA',
  ] as const)('RN-10.5: decidir em %s recebe 409', (status) => {
    const iniciativa = umaIniciativa().doAutor('ana').noStatus(status).construir();
    expect(() => iniciativa.decidir('APROVADA', undefined, 'carla', clockEm())).toThrow(
      TransicaoInvalidaError,
    );
  });

  it('a segunda decisão recebe 409 "já foi decidida"', () => {
    const iniciativa = umaIniciativa().doAutor('ana').emAnalise().construir();
    iniciativa.decidir('APROVADA', undefined, 'carla', clockEm());
    expect(() => iniciativa.decidir('REPROVADA', 'x', 'elisa', clockEm())).toThrow(
      'Esta iniciativa já foi decidida.',
    );
  });
});

describe('Iniciativa: RN-11 (ressubmissão)', () => {
  it('RN-11.1: reabre o refinamento com ciclo + 1 e limpa a decisão', () => {
    const iniciativa = umaIniciativa()
      .doAutor('ana')
      .reprovada('Ajustar o espaço.', 'carla')
      .construir();
    const novos = dadosDeTeste({ titulo: 'Título revisado' });

    iniciativa.ressubmeter(
      novos,
      false,
      'ana',
      clockEm(new Date('2026-11-20T12:00:00Z')),
      PRAZOS_PADRAO,
    );

    expect(iniciativa.status).toBe('EM_ANDAMENTO');
    expect(iniciativa.ciclo).toBe(2);
    expect(iniciativa.dados.titulo).toBe('Título revisado');
    expect(iniciativa.comVotacao).toBe(false);
    expect(iniciativa.fimRefinamento?.getTime()).toBe(
      new Date('2026-11-20T12:00:00Z').getTime() + 3 * DIA,
    );
    expect(iniciativa.fimVotacao).toBeNull();
    expect(iniciativa.decisorId).toBeNull();
    expect(iniciativa.decididaEm).toBeNull();
    expect(iniciativa.justificativa).toBeNull();
    expect(iniciativa.novasTransicoes()[0]).toMatchObject({
      de: 'REPROVADA',
      para: 'EM_ANDAMENTO',
      por: 'ana',
      nota: 'Ressubmetida após reprovação (ciclo 2)',
      ciclo: 2,
    });
    expect(iniciativa.pullEvents().map((e) => e.constructor.name)).toEqual([
      'IniciativaRessubmetida',
    ]);
  });

  it('RN-11.2: quem não é o autor recebe 403', () => {
    const iniciativa = umaIniciativa().doAutor('ana').reprovada().construir();
    expect(() =>
      iniciativa.ressubmeter(dadosDeTeste(), true, 'bruno', clockEm(), PRAZOS_PADRAO),
    ).toThrow(SomenteAutorError);
  });

  it.each([
    'EM_ANDAMENTO',
    'EM_VOTACAO',
    'EM_ANALISE',
    'APROVADA',
  ] as const)('RN-11.3: ressubmeter em %s recebe 409', (status) => {
    const iniciativa = umaIniciativa().doAutor('ana').noStatus(status).construir();
    expect(() =>
      iniciativa.ressubmeter(dadosDeTeste(), true, 'ana', clockEm(), PRAZOS_PADRAO),
    ).toThrow(/não podem ser ressubmetidas/);
  });

  it('RN-11.6: a terceira ressubmissão funciona (sem limite)', () => {
    const iniciativa = umaIniciativa().doAutor('ana').noCiclo(3).reprovada().construir();
    iniciativa.ressubmeter(dadosDeTeste(), true, 'ana', clockEm(), PRAZOS_PADRAO);
    expect(iniciativa.ciclo).toBe(4);
  });
});

describe('Iniciativa: tabela de transições (5 status × 5 operações)', () => {
  type Operacao = 'editar' | 'ressubmeter' | 'decidir' | 'encerrarRefinamento' | 'encerrarVotacao';

  const executar = (status: StatusIniciativa, operacao: Operacao) => {
    const iniciativa = umaIniciativa().doAutor('ana').noStatus(status).construir();
    const clock = clockEm();
    switch (operacao) {
      case 'editar':
        return () => iniciativa.editar(dadosDeTeste(), true, 'ana', clock);
      case 'ressubmeter':
        return () => iniciativa.ressubmeter(dadosDeTeste(), true, 'ana', clock, PRAZOS_PADRAO);
      case 'decidir':
        return () => iniciativa.decidir('APROVADA', undefined, 'carla', clock);
      case 'encerrarRefinamento':
        return () => iniciativa.encerrarRefinamento(PRAZOS_PADRAO);
      case 'encerrarVotacao':
        return () => iniciativa.encerrarVotacao();
    }
  };

  /** Único status em que cada operação é válida. */
  const VALIDA_EM: Record<Operacao, StatusIniciativa> = {
    editar: 'EM_ANDAMENTO',
    ressubmeter: 'REPROVADA',
    decidir: 'EM_ANALISE',
    encerrarRefinamento: 'EM_ANDAMENTO',
    encerrarVotacao: 'EM_VOTACAO',
  };

  const casos = (Object.keys(VALIDA_EM) as Operacao[]).flatMap((operacao) =>
    STATUS_INICIATIVA.map((status) => [status, operacao, VALIDA_EM[operacao] === status] as const),
  );

  it.each(casos)('%s + %s → %s', (status, operacao, valida) => {
    const acao = executar(status, operacao);
    if (valida) {
      expect(acao).not.toThrow();
    } else {
      expect(acao).toThrow(TransicaoInvalidaError);
    }
  });
});

describe('Iniciativa: permissoesPara', () => {
  const comite = (id: string) => ({ id, ehComite: true });
  const comum = (id: string) => ({ id, ehComite: false });
  const clock = clockEm();

  it('EM_ANDAMENTO: o autor edita e todos comentam; ninguém vota nem decide', () => {
    const iniciativa = umaIniciativa().doAutor('ana').construir();
    expect(iniciativa.permissoesPara(comum('ana'), clock)).toEqual({
      podeEditar: true,
      podeComentar: true,
      podeVotar: false,
      podeDecidir: false,
      podeRessubmeter: false,
    });
    expect(iniciativa.permissoesPara(comum('bruno'), clock)).toMatchObject({
      podeEditar: false,
      podeComentar: true,
    });
  });

  it('EM_VOTACAO: todos votam (inclusive o autor); ninguém edita nem comenta', () => {
    const iniciativa = umaIniciativa().doAutor('ana').emVotacao().construir();
    expect(iniciativa.permissoesPara(comum('ana'), clock)).toMatchObject({
      podeVotar: true,
      podeEditar: false,
      podeComentar: false,
    });
    expect(iniciativa.permissoesPara(comum('diego'), clock).podeVotar).toBe(true);
  });

  it('EM_ANALISE: só o comitê decide, e não o autor (com o motivo)', () => {
    const iniciativa = umaIniciativa().doAutor('carla').emAnalise().construir();
    expect(iniciativa.permissoesPara(comite('elisa'), clock).podeDecidir).toBe(true);
    expect(iniciativa.permissoesPara(comum('diego'), clock).podeDecidir).toBe(false);
    const doAutor = iniciativa.permissoesPara(comite('carla'), clock);
    expect(doAutor.podeDecidir).toBe(false);
    expect(doAutor.motivoNaoPodeDecidir).toBe(
      'Você é o autor desta iniciativa e não pode registrar a decisão. Outro membro do comitê deve fazê-lo.',
    );
    expect(iniciativa.permissoesPara(comite('elisa'), clock).motivoNaoPodeDecidir).toBeUndefined();
  });

  it('REPROVADA: só o autor ressubmete', () => {
    const iniciativa = umaIniciativa().doAutor('ana').reprovada().construir();
    expect(iniciativa.permissoesPara(comum('ana'), clock).podeRessubmeter).toBe(true);
    expect(iniciativa.permissoesPara(comum('bruno'), clock).podeRessubmeter).toBe(false);
  });

  it('com o prazo vencido e a transição ainda não aplicada, já não permite editar/comentar/votar', () => {
    const vencida = umaIniciativa().doAutor(AUTOR_PADRAO).construir();
    const depois = clockEm(new Date('2026-11-06T00:00:00Z'));
    expect(vencida.permissoesPara(comum(AUTOR_PADRAO), depois)).toMatchObject({
      podeEditar: false,
      podeComentar: false,
    });

    const votacaoVencida = umaIniciativa().emVotacao().construir();
    expect(
      votacaoVencida.permissoesPara(comum('x'), clockEm(new Date('2026-11-09T00:00:00Z')))
        .podeVotar,
    ).toBe(false);
  });
});

describe('Iniciativa: persistência', () => {
  it('confirmarGravacao limpa as transições pendentes e avança a versão', () => {
    const iniciativa = Iniciativa.submeter(dadosDeTeste(), 'ana', true, clockEm(), PRAZOS_PADRAO);
    expect(iniciativa.novasTransicoes()).toHaveLength(1);

    iniciativa.confirmarGravacao();

    expect(iniciativa.novasTransicoes()).toEqual([]);
    expect(iniciativa.version).toBe(1);
    expect(iniciativa.nova).toBe(false);
  });

  it('reconstituir não traz transições nem eventos pendentes', () => {
    const iniciativa = umaIniciativa().construir();
    expect(iniciativa.novasTransicoes()).toEqual([]);
    expect(iniciativa.pullEvents()).toEqual([]);
    expect(iniciativa.nova).toBe(false);
  });
});
