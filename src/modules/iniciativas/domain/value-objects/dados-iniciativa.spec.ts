import { dadosValidos } from '@/modules/iniciativas/testing/builders/iniciativa.builder';
import { ValidacaoError } from '@/shared/domain/domain-error';
import { DadosIniciativa, type DadosIniciativaBrutos, LIMITES } from './dados-iniciativa';

const TIPOS_ATIVOS = new Set(['EXTENSAO', 'PESQUISA', 'EVENTO']);

function errosDe(
  brutos: DadosIniciativaBrutos,
  tipos: ReadonlySet<string> = TIPOS_ATIVOS,
): Record<string, string> {
  try {
    DadosIniciativa.criar(brutos, tipos);
  } catch (error) {
    if (error instanceof ValidacaoError) return error.campos;
    throw error;
  }
  return {};
}

describe('DadosIniciativa: RN-01 (campos)', () => {
  it('RN-01.1: submissão válida passa e normaliza os campos', () => {
    const dados = DadosIniciativa.criar(
      dadosValidos({ titulo: '  Hackathon  ', membros: '   ', horaInicio: '', horaFim: '' }),
    );
    expect(dados.titulo).toBe('Hackathon');
    expect(dados.membros).toBeNull();
    expect(dados.horaInicio).toBeNull();
    expect(dados.temHorario).toBe(false);
    expect(dados.participantes).toBe(80);
  });

  it.each([
    ['tipo', 'Selecione o tipo.'],
    ['titulo', 'Informe o título.'],
    ['resumo', 'Escreva uma descrição resumida.'],
    ['detalhe', 'Escreva a descrição detalhada.'],
    ['inicio', 'Informe a data de início.'],
    ['fim', 'Informe a data de término.'],
    ['periodicidade', 'Selecione a periodicidade.'],
    ['espaco', 'Informe o espaço utilizado.'],
    ['organizadores', 'Informe ao menos um organizador.'],
    ['participantes', 'Informe um número maior que zero.'],
  ] as const)('RN-01.2: %s ausente gera erro só nesse campo, com a mensagem do protótipo', (campo, mensagem) => {
    expect(errosDe(dadosValidos({ [campo]: undefined }))).toEqual({ [campo]: mensagem });
  });

  it('RN-01.2: vários campos ausentes acumulam todos os erros num só ValidacaoError', () => {
    const erros = errosDe({});
    expect(Object.keys(erros).sort()).toEqual(
      [
        'detalhe',
        'espaco',
        'fim',
        'inicio',
        'organizadores',
        'participantes',
        'periodicidade',
        'resumo',
        'tipo',
        'titulo',
      ].sort(),
    );
  });

  it.each([
    ['titulo', LIMITES.titulo],
    ['resumo', LIMITES.resumo],
    ['detalhe', LIMITES.detalhe],
    ['espaco', LIMITES.espaco],
    ['organizadores', LIMITES.organizadores],
    ['membros', LIMITES.membros],
  ] as const)('RN-01.3: %s aceita %i caracteres e rejeita +1', (campo, limite) => {
    expect(errosDe(dadosValidos({ [campo]: 'a'.repeat(limite) }))).toEqual({});
    expect(Object.keys(errosDe(dadosValidos({ [campo]: 'a'.repeat(limite + 1) })))).toEqual([
      campo,
    ]);
  });

  it('RN-01.3: participantes aceita o máximo e rejeita o máximo + 1', () => {
    expect(errosDe(dadosValidos({ participantes: LIMITES.participantesMax }))).toEqual({});
    expect(
      Object.keys(errosDe(dadosValidos({ participantes: LIMITES.participantesMax + 1 }))),
    ).toEqual(['participantes']);
  });

  it.each([
    0,
    -3,
    1.5,
    Number.NaN,
    'abc',
    null,
  ])('RN-01.4: participantes %p é rejeitado', (valor) => {
    expect(errosDe(dadosValidos({ participantes: valor }))).toEqual({
      participantes: 'Informe um número maior que zero.',
    });
  });

  it('RN-01.4: participantes 1 é aceito', () => {
    expect(errosDe(dadosValidos({ participantes: 1 }))).toEqual({});
  });

  it('RN-01.5: strings só com espaços contam como vazias', () => {
    const erros = errosDe(dadosValidos({ titulo: '   ', resumo: '\t\n', espaco: '  ' }));
    expect(erros).toEqual({
      titulo: 'Informe o título.',
      resumo: 'Escreva uma descrição resumida.',
      espaco: 'Informe o espaço utilizado.',
    });
  });

  it('rejeita tipo fora dos tipos ativos do cadastro, e periodicidade fora da lista', () => {
    expect(errosDe(dadosValidos({ tipo: 'OFICINA' }))).toEqual({
      tipo: 'Este tipo não existe ou foi desativado. Selecione outro.',
    });
    expect(errosDe(dadosValidos({ tipo: 'oficina de código' }))).toEqual({
      tipo: 'Selecione o tipo.',
    });
    expect(errosDe(dadosValidos({ periodicidade: 'ANUAL' }))).toEqual({
      periodicidade: 'Selecione a periodicidade.',
    });
  });

  it('rejeita datas inexistentes ou em formato errado', () => {
    expect(errosDe(dadosValidos({ inicio: '2026-02-30' })).inicio).toBe(
      'Informe uma data de início válida.',
    );
    expect(errosDe(dadosValidos({ fim: '10/12/2026' })).fim).toBe(
      'Informe uma data de término válida.',
    );
  });
});

describe('DadosIniciativa: RN-02 (datas e horário)', () => {
  it('RN-02.1: fim == inicio passa', () => {
    expect(errosDe(dadosValidos({ inicio: '2026-12-10', fim: '2026-12-10' }))).toEqual({});
  });

  it('RN-02.2: fim < inicio falha, com a mensagem do protótipo', () => {
    expect(errosDe(dadosValidos({ inicio: '2026-12-10', fim: '2026-12-09' }))).toEqual({
      fim: 'A data de término deve ser igual ou posterior à de início.',
    });
  });

  it('RN-02.3: só horaInicio falha', () => {
    expect(errosDe(dadosValidos({ horaInicio: '09:00', horaFim: '' }))).toEqual({
      horaFim: 'Informe a hora de término ou apague a de início.',
    });
  });

  it('RN-02.4: só horaFim falha', () => {
    expect(errosDe(dadosValidos({ horaInicio: '', horaFim: '18:00' }))).toEqual({
      horaInicio: 'Informe a hora de início ou apague a de término.',
    });
  });

  it('RN-02.5: horaFim == horaInicio falha, e horaFim < horaInicio também', () => {
    const mensagem = { horaFim: 'A hora de término deve ser posterior à de início.' };
    expect(errosDe(dadosValidos({ horaInicio: '09:00', horaFim: '09:00' }))).toEqual(mensagem);
    expect(errosDe(dadosValidos({ horaInicio: '18:00', horaFim: '09:00' }))).toEqual(mensagem);
  });

  it('RN-02.6: sem horas passa e a iniciativa é de dia inteiro', () => {
    const dados = DadosIniciativa.criar(
      dadosValidos({ horaInicio: undefined, horaFim: undefined }),
    );
    expect(dados.temHorario).toBe(false);
    expect(dados.horaInicio).toBeNull();
    expect(dados.horaFim).toBeNull();
  });

  it('RN-02: com as duas horas válidas, guarda o horário', () => {
    const dados = DadosIniciativa.criar(dadosValidos());
    expect(dados.temHorario).toBe(true);
    expect([dados.horaInicio, dados.horaFim]).toEqual(['09:00', '18:00']);
  });

  it('rejeita hora em formato inválido', () => {
    expect(errosDe(dadosValidos({ horaInicio: '25:00', horaFim: '26:00' }))).toEqual({
      horaInicio: 'Informe uma hora de início válida.',
      horaFim: 'Informe uma hora de término válida.',
    });
  });
});

/**
 * Caracterização do comportamento atual de `criar` e `comDatas`, escrita antes da refatoração
 * DT-02 (docs/qualidade/divida-tecnica.md): mensagens exatas, ordem dos erros acumulados e as
 * combinações de datas e horas que dependem da ordem das verificações.
 */
describe('DadosIniciativa: comportamento preservado na refatoração (DT-02)', () => {
  it.each([
    ['titulo', LIMITES.titulo, `O título deve ter no máximo ${LIMITES.titulo} caracteres.`],
    [
      'resumo',
      LIMITES.resumo,
      `A descrição resumida deve ter no máximo ${LIMITES.resumo} caracteres.`,
    ],
    [
      'detalhe',
      LIMITES.detalhe,
      `A descrição detalhada deve ter no máximo ${LIMITES.detalhe} caracteres.`,
    ],
    ['espaco', LIMITES.espaco, `O espaço deve ter no máximo ${LIMITES.espaco} caracteres.`],
    [
      'organizadores',
      LIMITES.organizadores,
      `Os organizadores devem ter no máximo ${LIMITES.organizadores} caracteres.`,
    ],
    ['membros', LIMITES.membros, `Os membros devem ter no máximo ${LIMITES.membros} caracteres.`],
  ] as const)('%s acima do limite gera a mensagem exata', (campo, limite, mensagem) => {
    expect(errosDe(dadosValidos({ [campo]: 'a'.repeat(limite + 1) }))).toEqual({
      [campo]: mensagem,
    });
  });

  it('participantes acima do limite gera a mensagem exata', () => {
    expect(errosDe(dadosValidos({ participantes: LIMITES.participantesMax + 1 }))).toEqual({
      participantes: `O número de participantes deve ser no máximo ${LIMITES.participantesMax}.`,
    });
  });

  it('os erros acumulados saem na ordem dos campos do formulário', () => {
    expect(Object.keys(errosDe({}))).toEqual([
      'tipo',
      'titulo',
      'resumo',
      'detalhe',
      'inicio',
      'fim',
      'periodicidade',
      'espaco',
      'organizadores',
      'participantes',
    ]);
    expect(
      Object.keys(
        errosDe(
          dadosValidos({
            tipo: 'x',
            horaInicio: '25:00',
            horaFim: '26:00',
            membros: 'a'.repeat(LIMITES.membros + 1),
          }),
        ),
      ),
    ).toEqual(['tipo', 'horaInicio', 'horaFim', 'membros']);
  });

  it('término antes de um início inválido: só o início é apontado', () => {
    expect(errosDe(dadosValidos({ inicio: '2026-02-30', fim: '2026-01-01' }))).toEqual({
      inicio: 'Informe uma data de início válida.',
    });
  });

  it('hora de início inválida não é comparada com a de término', () => {
    expect(errosDe(dadosValidos({ horaInicio: '9h', horaFim: '08:00' }))).toEqual({
      horaInicio: 'Informe uma hora de início válida.',
    });
  });

  it('hora de término inválida gera só a mensagem de formato', () => {
    expect(errosDe(dadosValidos({ horaInicio: '09:00', horaFim: '8h' }))).toEqual({
      horaFim: 'Informe uma hora de término válida.',
    });
  });

  it('apara todos os textos e guarda os valores na ordem recebida', () => {
    const dados = DadosIniciativa.criar(
      dadosValidos({
        tipo: ' EVENTO ',
        resumo: ' r ',
        detalhe: ' d ',
        espaco: ' e ',
        organizadores: ' o ',
        membros: ' m ',
        periodicidade: ' SEMANAL ',
        inicio: ' 2026-12-10 ',
        fim: ' 2026-12-11 ',
        horaInicio: ' 09:00 ',
        horaFim: ' 10:00 ',
        participantes: '12',
      }),
      TIPOS_ATIVOS,
    );
    expect({ ...dados }).toEqual({
      tipo: 'EVENTO',
      titulo: dadosValidos().titulo,
      resumo: 'r',
      detalhe: 'd',
      inicio: '2026-12-10',
      fim: '2026-12-11',
      horaInicio: '09:00',
      horaFim: '10:00',
      periodicidade: 'SEMANAL',
      espaco: 'e',
      organizadores: 'o',
      membros: 'm',
      participantes: 12,
    });
    expect(Object.keys(dados)).toEqual([
      'tipo',
      'titulo',
      'resumo',
      'detalhe',
      'inicio',
      'fim',
      'horaInicio',
      'horaFim',
      'periodicidade',
      'espaco',
      'organizadores',
      'membros',
      'participantes',
    ]);
  });

  it('sem a lista de tipos permitidos, confere só o formato do código', () => {
    expect(DadosIniciativa.criar(dadosValidos({ tipo: 'QUALQUER_TIPO' })).tipo).toBe(
      'QUALQUER_TIPO',
    );
  });

  it('comDatas troca só datas e horários e mantém os outros campos', () => {
    const antes = DadosIniciativa.criar(dadosValidos({ membros: 'Ana' }));
    const depois = antes.comDatas({ inicio: '2027-01-05', fim: '2027-01-06', horaInicio: null });
    expect({ ...depois }).toEqual({
      ...antes,
      inicio: '2027-01-05',
      fim: '2027-01-06',
      horaInicio: null,
      horaFim: null,
    });
  });

  it('comDatas revalida: só os erros de data e hora aparecem', () => {
    const dados = DadosIniciativa.criar(dadosValidos());
    expect(() =>
      dados.comDatas({ inicio: '2027-01-06', fim: '2027-01-05', horaInicio: '10:00' }),
    ).toThrow(ValidacaoError);
    try {
      dados.comDatas({ inicio: '2027-01-06', fim: '2027-01-05', horaInicio: '10:00' });
    } catch (error) {
      expect((error as ValidacaoError).campos).toEqual({
        fim: 'A data de término deve ser igual ou posterior à de início.',
        horaFim: 'Informe a hora de término ou apague a de início.',
      });
    }
  });
});

describe('DadosIniciativa: tipos do cadastro', () => {
  it('aceita qualquer tipo ativo cadastrado, como PALESTRA', () => {
    const dados = DadosIniciativa.criar(dadosValidos({ tipo: 'PALESTRA' }), new Set(['PALESTRA']));
    expect(dados.tipo).toBe('PALESTRA');
  });

  it('sem nenhum tipo cadastrado, nenhuma iniciativa pode ser submetida', () => {
    expect(errosDe(dadosValidos({ tipo: 'EVENTO' }), new Set())).toEqual({
      tipo: 'Este tipo não existe ou foi desativado. Selecione outro.',
    });
  });
});
