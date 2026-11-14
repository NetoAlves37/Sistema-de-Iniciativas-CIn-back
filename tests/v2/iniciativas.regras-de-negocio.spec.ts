import { describe, expect, it } from 'vitest';
import { PRAZOS_PADRAO, umaIniciativa } from '@/modules/iniciativas/testing/builders/iniciativa.builder';
import { DIA, entrada, montar, T0 } from '@/modules/iniciativas/testing/montar-casos-de-uso';
import { ValidacaoError } from '@/shared/domain/domain-error';
import { FakeClock } from '@/shared/testing/fake-clock';
import {
  AutorNaoPodeDecidirError,
  SomenteAutorError,
  TransicaoInvalidaError,
} from '@/modules/iniciativas/domain/errors/iniciativas.errors';
import { Iniciativa } from '@/modules/iniciativas/domain/iniciativa';
import { DadosIniciativa } from '@/modules/iniciativas/domain/value-objects/dados-iniciativa';

/* ===========================================================================
 * HELPERS
 * ATENÇÃO: os nomes dos campos de `entrada()` abaixo (tipo, resumo, detalhe,
 * inicio, fim, horaInicio, horaFim, espaco, periodicidade, organizadores)
 * seguem o padrão do DTO; só `titulo`, `participantes`, `fim` e `comVotacao`
 * aparecem nos testes originais. Ajuste se o DTO usar outro nome.
 * ========================================================================= */
const txt = (n: number) => 'a'.repeat(n);

const criar = (clock: FakeClock, comVotacao = true, autor = 'ana') =>
  Iniciativa.submeter(DadosIniciativa.criar(entrada()), autor, comVotacao, clock, PRAZOS_PADRAO);

const emVotacao = (clock: FakeClock) => {
  const i = criar(clock, true);
  i.encerrarRefinamento(PRAZOS_PADRAO);
  return i;
};
const emAnalise = (clock: FakeClock) => {
  const i = criar(clock, false);
  i.encerrarRefinamento(PRAZOS_PADRAO);
  return i;
};
const aprovada = (clock: FakeClock) => {
  const i = emAnalise(clock);
  i.decidir('APROVADA', undefined, 'carla', clock);
  return i;
};
const reprovada = (clock: FakeClock) => {
  const i = emAnalise(clock);
  i.decidir('REPROVADA', 'Sem espaço.', 'carla', clock);
  return i;
};
const usuario = (id: string, ehComite = false) => ({ id, ehComite });

/* ===========================================================================
 * US01 - SUBMISSÃO
 * ========================================================================= */
describe('US01 - Submissão de Iniciativa', () => {
  it('US01 sucesso | Partição de Equivalência (classe válida) | cria com status EM_ANDAMENTO', async () => {
    // Requisito: US01 - campos obrigatórios válidos
    // Técnica: Partição de Equivalência (classe válida)
    // Esperado: iniciativa persistida em EM_ANDAMENTO, ciclo 1
    const { submeter, repositorio } = montar();
    const id = await submeter.executar('ana', entrada());
    expect(repositorio.persistida(id)).toMatchObject({ status: 'EM_ANDAMENTO', ciclo: 1 });
  });

  it.each(['EXTENSAO', 'PESQUISA', 'EVENTO'])(
    'US01 tipo válido %s | Partição de Equivalência (classe válida) | aceito',
    (tipo) => {
      // Requisito: US01 - tipo permitido
      // Técnica: Partição de Equivalência (cada valor do domínio)
      // Esperado: DadosIniciativa.criar aceita e devolve o mesmo tipo informado
      expect(DadosIniciativa.criar(entrada({ tipo })).tipo).toBe(tipo);
    },
  );

  it.each(['OUTRO', '', 'extensao'])(
    'US01 tipo inválido "%s" | Partição de Equivalência (classe inválida) | ValidacaoError',
    (tipo) => {
      // Requisito: US01 - tipo diferente de EXTENSAO/PESQUISA/EVENTO
      // Técnica: Partição de Equivalência (classe inválida)
      // Esperado: ValidacaoError
      expect(() => DadosIniciativa.criar(entrada({ tipo }))).toThrow(ValidacaoError);
    },
  );

  it.each([
    ['titulo', 120, 'válido'],
    ['titulo', 121, 'inválido'],
    ['titulo', 1, 'válido'],
    ['titulo', 0, 'inválido'],
    ['resumo', 280, 'válido'],
    ['resumo', 281, 'inválido'],
    ['resumo', 1, 'válido'],
    ['resumo', 0, 'inválido'],
    ['detalhe', 5000, 'válido'],
    ['detalhe', 5001, 'inválido'],
    ['detalhe', 1, 'válido'],
    ['detalhe', 0, 'inválido'],
    ['espaco', 200, 'válido'],
    ['espaco', 201, 'inválido'],
    ['espaco', 1, 'válido'],
    ['espaco', 0, 'inválido'],
  ])('US01 %s com %i caracteres | Valor-Limite | %s', (campo, tamanho, resultado) => {
    // Requisito: US01 - limites de tamanho de título (120), resumo (280), detalhe (5000), espaço (200)
    // Técnica: Análise de Valor-Limite (mínimo, mínimo-1, máximo, máximo+1)
    // Esperado: dentro do limite aceita e guarda o texto inteiro; vazio ou acima do máximo lança ValidacaoError
    const acao = () => DadosIniciativa.criar(entrada({ [campo]: txt(tamanho) }));
    if (resultado === 'válido')
      expect(acao()[campo as 'titulo' | 'resumo' | 'detalhe' | 'espaco']).toBe(txt(tamanho));
    else expect(acao).toThrow(ValidacaoError);
  });

  it('US01 título só com espaços | Partição de Equivalência (classe inválida) | ValidacaoError', () => {
    // Requisito: US01 - título vazio
    // Técnica: Partição de Equivalência (vazio / em branco)
    // Esperado: ValidacaoError (assume-se trim na validação)
    expect(() => DadosIniciativa.criar(entrada({ titulo: '   ' }))).toThrow(ValidacaoError);
  });

  it.each(['31/12/2030', 'abc', '2030-13-40', ''])(
    'US01 data de início com formato inválido "%s" | Partição de Equivalência (classe inválida) | ValidacaoError',
    (inicio) => {
      // Requisito: US01 - datas em formato inválido
      // Técnica: Partição de Equivalência
      // Esperado: ValidacaoError
      expect(() => DadosIniciativa.criar(entrada({ inicio }))).toThrow(ValidacaoError);
    },
  );

  it('US01 término 1 dia antes do início | Valor-Limite (mínimo inválido) | ValidacaoError', () => {
    // Requisito: US01 - data de término anterior à de início
    // Técnica: Valor-Limite (início - 1 dia)
    // Esperado: ValidacaoError
    expect(() =>
      DadosIniciativa.criar(entrada({ inicio: '2030-05-10', fim: '2030-05-09' })),
    ).toThrow(ValidacaoError);
  });

  it('US01 término igual ao início | Valor-Limite (fronteira válida) | aceito', () => {
    // Requisito: US01 - término não pode ser ANTERIOR ao início (igual é permitido)
    // Técnica: Valor-Limite (início == término)
    // Esperado: aceito, com início e término iguais
    expect(
      DadosIniciativa.criar(
        entrada({ inicio: '2030-05-10', fim: '2030-05-10', horaInicio: '08:00', horaFim: '10:00' }),
      ),
    ).toMatchObject({ inicio: '2030-05-10', fim: '2030-05-10' });
  });

  it('US01 término 1 dia depois do início | Valor-Limite (primeiro válido) | aceito', () => {
    // Requisito: US01 - datas
    // Técnica: Valor-Limite (início + 1 dia)
    // Esperado: aceito, com término 1 dia depois do início
    expect(
      DadosIniciativa.criar(entrada({ inicio: '2030-05-10', fim: '2030-05-11' })),
    ).toMatchObject({ inicio: '2030-05-10', fim: '2030-05-11' });
  });

  it.each([
    ['09:59', 'inválido'],
    ['10:00', 'inválido'],
    ['10:01', 'válido'],
  ])('US01 horário fim %s (início 10:00, mesmo dia) | Valor-Limite | %s', (horaFim, resultado) => {
    // Requisito: US01 - horário de término deve ser > horário de início
    // Técnica: Valor-Limite (início-1min, início, início+1min)
    // Esperado: <= início lança ValidacaoError; > início aceita e guarda a hora de término
    const acao = () =>
      DadosIniciativa.criar(
        entrada({ inicio: '2030-05-10', fim: '2030-05-10', horaInicio: '10:00', horaFim }),
      );
    if (resultado === 'válido') expect(acao().horaFim).toBe(horaFim);
    else expect(acao).toThrow(ValidacaoError);
  });

  it.each(['25:00', '10:60', 'dez', ''])(
    'US01 horário com formato inválido "%s" | Partição de Equivalência (classe inválida) | ValidacaoError',
    (horaInicio) => {
      // Requisito: US01 - horário em formato inválido
      // Técnica: Partição de Equivalência
      // Esperado: ValidacaoError
      expect(() => DadosIniciativa.criar(entrada({ horaInicio }))).toThrow(ValidacaoError);
    },
  );

  it('US01 periodicidade fora do permitido | Partição de Equivalência (classe inválida) | ValidacaoError', () => {
    // Requisito: US01 - periodicidade fora do conjunto permitido
    // Técnica: Partição de Equivalência
    // Esperado: ValidacaoError
    expect(() => DadosIniciativa.criar(entrada({ periodicidade: 'QUINZENAL_INEXISTENTE' }))).toThrow(
      ValidacaoError,
    );
  });

  it('US01 organizadores vazio | Partição de Equivalência (classe inválida) | ValidacaoError', () => {
    // Requisito: US01 - organizadores obrigatórios
    // Técnica: Partição de Equivalência
    // Esperado: ValidacaoError
    expect(() => DadosIniciativa.criar(entrada({ organizadores: [] }))).toThrow(ValidacaoError);
  });

  it.each([
    [0, 'inválido'],
    [-1, 'inválido'],
    [1, 'válido'],
    [2, 'válido'],
    [1.5, 'inválido'],
  ])('US01 participantes = %s | Valor-Limite | %s', (participantes, resultado) => {
    // Requisito: US01 - participantes >= 1 e inteiro
    // Técnica: Valor-Limite (0, 1, 2) + Partição (negativo, decimal)
    // Esperado: <1 ou não inteiro lança ValidacaoError; inteiro >= 1 aceita e guarda o número
    const acao = () => DadosIniciativa.criar(entrada({ participantes }));
    if (resultado === 'válido') expect(acao().participantes).toBe(participantes);
    else expect(acao).toThrow(ValidacaoError);
  });

  it('US01 dados inválidos | Partição de Equivalência (classe inválida) | nada é gravado', async () => {
    // Requisito: US01 - erro de validação não cria iniciativa
    // Técnica: Partição de Equivalência
    // Esperado: ValidacaoError e histórico vazio
    const { submeter, repositorio } = montar();
    await expect(submeter.executar('ana', entrada({ titulo: '' }))).rejects.toBeInstanceOf(
      ValidacaoError,
    );
    expect(repositorio.historico).toEqual([]);
  });
});

/* ===========================================================================
 * US02 - AVALIAÇÃO
 * ========================================================================= */
describe('US02 - Avaliação de Iniciativa', () => {
  it('US02 aprovação | Partição de Equivalência (resultado APROVADA) | status APROVADA', async () => {
    // Requisito: US02 - aprovação
    // Técnica: Partição de Equivalência (resultado = APROVADA)
    // Esperado: status APROVADA e decisor registrado
    const { decidir, repositorio } = montar();
    repositorio.semear(umaIniciativa().comId('i1').doAutor('ana').emAnalise().construir());
    await decidir.executar('i1', 'carla', 'APROVADA', undefined);
    expect(repositorio.persistida('i1')).toMatchObject({ status: 'APROVADA', decisorId: 'carla' });
  });

  it('US02 reprovação com justificativa | Partição de Equivalência (REPROVADA válida) | status REPROVADA', async () => {
    // Requisito: US02 - reprovação exige justificativa
    // Técnica: Partição de Equivalência (justificativa preenchida)
    // Esperado: status REPROVADA com justificativa gravada
    const { decidir, repositorio } = montar();
    repositorio.semear(umaIniciativa().comId('i1').doAutor('ana').emAnalise().construir());
    await decidir.executar('i1', 'carla', 'REPROVADA', 'Sem espaço.');
    expect(repositorio.persistida('i1')).toMatchObject({
      status: 'REPROVADA',
      justificativa: 'Sem espaço.',
    });
  });

  it.each([undefined, null, '', '   '])(
    'US02 reprovação com justificativa %j | Partição de Equivalência (classe inválida) | erro',
    async (justificativa) => {
      // Requisito: US02 - reprovar sem justificativa é erro
      // Técnica: Partição de Equivalência (undefined, null, vazio, só espaços)
      // Esperado: rejeita a operação e a iniciativa continua EM_ANALISE
      // OBS: no código fornecido, nem Iniciativa.decidir nem DecidirIniciativa validam isso
      // (o comentário diz que é "validado no caso de uso"). Se este teste falhar, é um
      // defeito real em relação ao critério de aceitação.
      const { decidir, repositorio } = montar();
      repositorio.semear(umaIniciativa().comId('i1').doAutor('ana').emAnalise().construir());
      await expect(decidir.executar('i1', 'carla', 'REPROVADA', justificativa)).rejects.toBeInstanceOf(ValidacaoError);
      expect(repositorio.persistida('i1').status).toBe('EM_ANALISE');
    },
  );

  it.each(['EM_ANDAMENTO', 'EM_VOTACAO', 'APROVADA', 'REPROVADA'])(
    'US02 avaliar iniciativa em %s | Partição de Equivalência (status inválido) | TransicaoInvalidaError',
    (status) => {
      // Requisito: US02 - apenas EM_ANALISE pode ser avaliada
      // Técnica: Partição de Equivalência (cada status diferente de EM_ANALISE)
      // Esperado: TransicaoInvalidaError
      const clock = new FakeClock(T0);
      const mapa: Record<string, () => Iniciativa> = {
        EM_ANDAMENTO: () => criar(clock),
        EM_VOTACAO: () => emVotacao(clock),
        APROVADA: () => aprovada(clock),
        REPROVADA: () => reprovada(clock),
      };
      expect(() => mapa[status]().decidir('APROVADA', undefined, 'carla', clock)).toThrow(
        TransicaoInvalidaError,
      );
    },
  );

  it('US02 autor avalia a própria iniciativa | Partição de Equivalência (autor) | AutorNaoPodeDecidirError', async () => {
    // Requisito: US02 - autor não avalia a própria iniciativa
    // Técnica: Partição de Equivalência (decisor == autor)
    // Esperado: AutorNaoPodeDecidirError
    const { decidir, repositorio } = montar();
    repositorio.semear(umaIniciativa().comId('i1').doAutor('carla').emAnalise().construir());
    await expect(decidir.executar('i1', 'carla', 'APROVADA', undefined)).rejects.toBeInstanceOf(
      AutorNaoPodeDecidirError,
    );
  });

  it('US02 permissão de decidir | Partição de Equivalência (perfis) | só comitê não-autor em EM_ANALISE', () => {
    // Requisito: US02 - usuário sem permissão (não comitê) não decide
    // Técnica: Partição de Equivalência (comitê, não-comitê, autor-comitê)
    // Esperado: podeDecidir true só para comitê que não é autor
    // (o bloqueio HTTP de acesso negado fica na camada de controller, não fornecida)
    const clock = new FakeClock(T0);
    const i = emAnalise(clock);
    expect(i.permissoesPara(usuario('carla', true), clock).podeDecidir).toBe(true);
    expect(i.permissoesPara(usuario('bruno', false), clock).podeDecidir).toBe(false);
    const doAutor = i.permissoesPara(usuario('ana', true), clock);
    expect(doAutor.podeDecidir).toBe(false);
    expect(doAutor.motivoNaoPodeDecidir).toBe(new AutorNaoPodeDecidirError().message);
  });

  it('US02 pós-avaliação | Partição de Equivalência (estado final) | sai da fila de análise', () => {
    // Requisito: US02 - após avaliação não fica mais na fila de análise
    // Técnica: Partição de Equivalência (antes x depois da decisão)
    // Esperado: status deixa EM_ANALISE e podeDecidir passa a false
    const clock = new FakeClock(T0);
    const i = emAnalise(clock);
    expect(i.status).toBe('EM_ANALISE');
    i.decidir('APROVADA', undefined, 'carla', clock);
    expect(i.status).toBe('APROVADA');
    expect(i.permissoesPara(usuario('carla', true), clock).podeDecidir).toBe(false);
  });
});

/* ===========================================================================
 * US05 - EDIÇÃO E RESSUBMISSÃO
 * ========================================================================= */
describe('US05 - Edição e Ressubmissão', () => {
  it('US05 edição pelo autor em EM_ANDAMENTO | Partição de Equivalência (classe válida) | dados atualizados', () => {
    // Requisito: US05 - autor edita em EM_ANDAMENTO
    // Técnica: Partição de Equivalência
    // Esperado: título atualizado, status permanece EM_ANDAMENTO
    const clock = new FakeClock(T0);
    const i = criar(clock);
    i.editar(DadosIniciativa.criar(entrada({ titulo: 'Novo' })), true, 'ana', clock);
    expect(i.dados.titulo).toBe('Novo');
    expect(i.status).toBe('EM_ANDAMENTO');
  });

  it('US05 edição por não autor | Partição de Equivalência (classe inválida) | SomenteAutorError', () => {
    // Requisito: US05 - só o autor edita
    // Técnica: Partição de Equivalência
    // Esperado: SomenteAutorError
    const clock = new FakeClock(T0);
    const i = criar(clock);
    expect(() => i.editar(DadosIniciativa.criar(entrada()), true, 'bruno', clock)).toThrow(
      SomenteAutorError,
    );
  });

  it.each(['EM_VOTACAO', 'EM_ANALISE', 'APROVADA', 'REPROVADA'])(
    'US05 edição em %s | Partição de Equivalência (status inválido) | TransicaoInvalidaError',
    (status) => {
      // Requisito: US05 - edição só em EM_ANDAMENTO
      // Técnica: Partição de Equivalência (cada status != EM_ANDAMENTO)
      // Esperado: TransicaoInvalidaError
      const clock = new FakeClock(T0);
      const mapa: Record<string, () => Iniciativa> = {
        EM_VOTACAO: () => emVotacao(clock),
        EM_ANALISE: () => emAnalise(clock),
        APROVADA: () => aprovada(clock),
        REPROVADA: () => reprovada(clock),
      };
      expect(() =>
        mapa[status]().editar(DadosIniciativa.criar(entrada()), true, 'ana', clock),
      ).toThrow(TransicaoInvalidaError);
    },
  );

  it('US05 ressubmissão pelo autor em REPROVADA | Partição de Equivalência | ciclo +1 e EM_ANDAMENTO', () => {
    // Requisito: US05 - ressubmissão incrementa ciclo e volta a EM_ANDAMENTO
    // Técnica: Partição de Equivalência (classe válida)
    // Esperado: ciclo 1 -> 2, status EM_ANDAMENTO
    const clock = new FakeClock(T0);
    const i = reprovada(clock);
    expect(i.ciclo).toBe(1);
    i.ressubmeter(DadosIniciativa.criar(entrada()), true, 'ana', clock, PRAZOS_PADRAO);
    expect(i.ciclo).toBe(2);
    expect(i.status).toBe('EM_ANDAMENTO');
  });

  it('US05 ressubmissão por não autor | Partição de Equivalência (classe inválida) | SomenteAutorError', () => {
    // Requisito: US05 - só o autor ressubmete
    // Técnica: Partição de Equivalência
    // Esperado: SomenteAutorError
    const clock = new FakeClock(T0);
    const i = reprovada(clock);
    expect(() =>
      i.ressubmeter(DadosIniciativa.criar(entrada()), true, 'bruno', clock, PRAZOS_PADRAO),
    ).toThrow(SomenteAutorError);
  });

  it.each(['EM_ANDAMENTO', 'EM_VOTACAO', 'EM_ANALISE', 'APROVADA'])(
    'US05 ressubmissão em %s | Partição de Equivalência (status inválido) | TransicaoInvalidaError',
    (status) => {
      // Requisito: US05 - ressubmissão só em REPROVADA
      // Técnica: Partição de Equivalência (cada status != REPROVADA)
      // Esperado: TransicaoInvalidaError
      const clock = new FakeClock(T0);
      const mapa: Record<string, () => Iniciativa> = {
        EM_ANDAMENTO: () => criar(clock),
        EM_VOTACAO: () => emVotacao(clock),
        EM_ANALISE: () => emAnalise(clock),
        APROVADA: () => aprovada(clock),
      };
      expect(() =>
        mapa[status]().ressubmeter(DadosIniciativa.criar(entrada()), true, 'ana', clock, PRAZOS_PADRAO),
      ).toThrow(TransicaoInvalidaError);
    },
  );

  it('US05 ressubmissão com dados idênticos | Partição de Equivalência (caso limite de dados) | aceita', () => {
    // Requisito: US05 - é permitido ressubmeter com dados idênticos
    // Técnica: Partição de Equivalência (dados == anteriores)
    // Esperado: sem erro, ciclo incrementado
    const clock = new FakeClock(T0);
    const i = reprovada(clock);
    const mesmos = i.dados;
    expect(() => i.ressubmeter(mesmos, i.comVotacao, 'ana', clock, PRAZOS_PADRAO)).not.toThrow();
    expect(i.ciclo).toBe(2);
  });
});

/* ===========================================================================
 * US06 - COMENTÁRIOS (regra de permissão do domínio: podeComentar)
 * O caso de uso de comentar (tamanho 1000, vazio, inexistente) não foi
 * fornecido, então aqui testa-se a regra de fase/status.
 * ========================================================================= */
describe('US06 - Comentários (permissão por status e prazo de refinamento)', () => {
  it('US06 EM_ANDAMENTO com refinamento aberto | Partição de Equivalência (classe válida) | pode comentar', () => {
    // Requisito: US06 - comentário permitido em EM_ANDAMENTO com refinamento aberto
    // Técnica: Partição de Equivalência
    // Esperado: podeComentar true
    const clock = new FakeClock(T0);
    expect(criar(clock).permissoesPara(usuario('bruno'), clock).podeComentar).toBe(true);
  });

  it('US06 1 ms antes do fim do refinamento | Valor-Limite (último instante válido) | pode comentar', () => {
    // Requisito: US06 - refinamento ainda aberto
    // Técnica: Valor-Limite (fim - 1ms)
    // Esperado: podeComentar true
    const clock = new FakeClock(T0);
    const i = criar(clock);
    clock.advance(3 * DIA - 1);
    expect(i.permissoesPara(usuario('bruno'), clock).podeComentar).toBe(true);
  });

  it('US06 exatamente no fim do refinamento | Valor-Limite (fronteira) | não pode comentar', () => {
    // Requisito: US06 - fase de refinamento encerrada
    // Técnica: Valor-Limite (agora == fimRefinamento). Decisão da equipe (L12): no instante exato do fim o refinamento já está encerrado
    // Esperado: podeComentar false
    const clock = new FakeClock(T0);
    const i = criar(clock);
    clock.advance(3 * DIA);
    expect(i.permissoesPara(usuario('bruno'), clock).podeComentar).toBe(false);
  });

  it('US06 1 ms após o fim do refinamento | Valor-Limite (primeiro instante inválido+1) | não pode comentar', () => {
    // Requisito: US06 - fase de refinamento encerrada
    // Técnica: Valor-Limite (fim + 1ms)
    // Esperado: podeComentar false
    const clock = new FakeClock(T0);
    const i = criar(clock);
    clock.advance(3 * DIA + 1);
    expect(i.permissoesPara(usuario('bruno'), clock).podeComentar).toBe(false);
  });

  it.each(['EM_VOTACAO', 'EM_ANALISE', 'APROVADA', 'REPROVADA'])(
    'US06 status %s | Partição de Equivalência (status inválido) | não pode comentar',
    (status) => {
      // Requisito: US06 - comentário só em EM_ANDAMENTO
      // Técnica: Partição de Equivalência (cada status != EM_ANDAMENTO)
      // Esperado: podeComentar false
      const clock = new FakeClock(T0);
      const mapa: Record<string, () => Iniciativa> = {
        EM_VOTACAO: () => emVotacao(clock),
        EM_ANALISE: () => emAnalise(clock),
        APROVADA: () => aprovada(clock),
        REPROVADA: () => reprovada(clock),
      };
      expect(mapa[status]().permissoesPara(usuario('bruno'), clock).podeComentar).toBe(false);
    },
  );
});
