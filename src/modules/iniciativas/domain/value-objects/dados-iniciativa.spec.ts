import { ValidacaoError } from '@/shared/domain/domain-error';
import { dadosValidos } from '@/shared/testing/builders/iniciativa.builder';
import { DadosIniciativa, type DadosIniciativaBrutos, LIMITES } from './dados-iniciativa';

function errosDe(brutos: DadosIniciativaBrutos): Record<string, string> {
  try {
    DadosIniciativa.criar(brutos);
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

  it('rejeita tipo e periodicidade fora da lista', () => {
    expect(errosDe(dadosValidos({ tipo: 'OFICINA' }))).toEqual({ tipo: 'Selecione o tipo.' });
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
