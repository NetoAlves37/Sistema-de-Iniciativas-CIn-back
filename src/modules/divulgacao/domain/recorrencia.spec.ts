import { ValidacaoError } from '@/shared/domain/domain-error';
import { diaDoMes, diaParaNumero, diasNoMes, numeroParaDia, somarDias } from './datas';
import { MAXIMO_DIAS_INTERVALO, validarIntervalo } from './intervalo';
import { gerarOcorrencias, type PeriodoRecorrente } from './recorrencia';

const periodo = (parcial: Partial<PeriodoRecorrente>): PeriodoRecorrente => ({
  inicio: '2026-11-03',
  fim: '2026-11-20',
  horaInicio: null,
  horaFim: null,
  periodicidade: 'DIARIA',
  ...parcial,
});

const inicios = (p: PeriodoRecorrente, de: string, ate: string) =>
  gerarOcorrencias(p, de, ate).map((o) => o.inicio);

/**
 * Os valores esperados de RN-12.1 e RN-12.2 foram gerados executando `occurs()` e
 * `buildEvents()` do protótipo (docs/prototipo.html) em Node, em dois fusos horários
 * (America/Recife e Asia/Tokyo, com o mesmo resultado).
 */
describe('gerarOcorrencias (RN-12)', () => {
  describe('RN-12.1: cada periodicidade no intervalo', () => {
    it('Diária: todos os dias do período dentro do intervalo, dia inteiro', () => {
      expect(gerarOcorrencias(periodo({}), '2026-11-01', '2026-11-08')).toEqual([
        { inicio: '2026-11-03', fim: '2026-11-03', diaInteiro: true },
        { inicio: '2026-11-04', fim: '2026-11-04', diaInteiro: true },
        { inicio: '2026-11-05', fim: '2026-11-05', diaInteiro: true },
        { inicio: '2026-11-06', fim: '2026-11-06', diaInteiro: true },
        { inicio: '2026-11-07', fim: '2026-11-07', diaInteiro: true },
      ]);
    });

    it('Semanal: a cada 7 dias a partir do início, com o horário em cada ocorrência', () => {
      const p = periodo({
        periodicidade: 'SEMANAL',
        inicio: '2026-11-02',
        fim: '2026-12-31',
        horaInicio: '19:00',
        horaFim: '21:00',
      });
      expect(gerarOcorrencias(p, '2026-11-01', '2026-12-01')).toEqual([
        { inicio: '2026-11-02T19:00', fim: '2026-11-02T21:00', diaInteiro: false },
        { inicio: '2026-11-09T19:00', fim: '2026-11-09T21:00', diaInteiro: false },
        { inicio: '2026-11-16T19:00', fim: '2026-11-16T21:00', diaInteiro: false },
        { inicio: '2026-11-23T19:00', fim: '2026-11-23T21:00', diaInteiro: false },
        { inicio: '2026-11-30T19:00', fim: '2026-11-30T21:00', diaInteiro: false },
      ]);
    });

    it('Quinzenal: a cada 14 dias a partir do início', () => {
      const p = periodo({ periodicidade: 'QUINZENAL', inicio: '2026-11-02', fim: '2026-12-31' });
      expect(inicios(p, '2026-11-01', '2027-01-01')).toEqual([
        '2026-11-02',
        '2026-11-16',
        '2026-11-30',
        '2026-12-14',
        '2026-12-28',
      ]);
    });

    it('Mensal: o mesmo dia do mês do início', () => {
      const p = periodo({ periodicidade: 'MENSAL', inicio: '2026-10-15', fim: '2027-02-28' });
      expect(inicios(p, '2026-10-01', '2026-12-01')).toEqual(['2026-10-15', '2026-11-15']);
    });

    it('Evento único sem horário: um bloco do início ao fim, com fim exclusivo (fim + 1)', () => {
      const p = periodo({ periodicidade: 'EVENTO_UNICO', inicio: '2026-11-10', fim: '2026-11-12' });
      expect(gerarOcorrencias(p, '2026-11-01', '2026-12-01')).toEqual([
        { inicio: '2026-11-10', fim: '2026-11-13', diaInteiro: true },
      ]);
    });

    it('Evento único com horário: uma ocorrência por dia do período, no horário', () => {
      const p = periodo({
        periodicidade: 'EVENTO_UNICO',
        inicio: '2026-11-10',
        fim: '2026-11-12',
        horaInicio: '09:00',
        horaFim: '11:00',
      });
      expect(gerarOcorrencias(p, '2026-11-01', '2026-12-01')).toEqual([
        { inicio: '2026-11-10T09:00', fim: '2026-11-10T11:00', diaInteiro: false },
        { inicio: '2026-11-11T09:00', fim: '2026-11-11T11:00', diaInteiro: false },
        { inicio: '2026-11-12T09:00', fim: '2026-11-12T11:00', diaInteiro: false },
      ]);
      expect(inicios(p, '2026-11-11', '2026-11-12')).toEqual(['2026-11-11T09:00']);
    });

    it('sem horário de fim, repete o de início', () => {
      const p = periodo({ horaInicio: '10:00', horaFim: null, fim: '2026-11-03' });
      expect(gerarOcorrencias(p, '2026-11-01', '2026-11-08')).toEqual([
        { inicio: '2026-11-03T10:00', fim: '2026-11-03T10:00', diaInteiro: false },
      ]);
    });
  });

  it('datas inválidas não geram ocorrências', () => {
    expect(gerarOcorrencias(periodo({}), 'x', '2026-11-08')).toEqual([]);
    expect(gerarOcorrencias(periodo({ inicio: 'y' }), '2026-11-01', '2026-11-08')).toEqual([]);
  });

  describe('RN-12.2: a borda do intervalo é exclusiva', () => {
    it('não devolve o dia `ate`', () => {
      expect(inicios(periodo({}), '2026-11-01', '2026-11-05')).toEqual([
        '2026-11-03',
        '2026-11-04',
      ]);
    });

    it('devolve o dia `de`', () => {
      expect(inicios(periodo({}), '2026-11-19', '2026-11-25')).toEqual([
        '2026-11-19',
        '2026-11-20',
      ]);
    });

    it('nada fora de [inicio, fim] do período', () => {
      expect(inicios(periodo({}), '2026-12-01', '2026-12-10')).toEqual([]);
      expect(inicios(periodo({}), '2026-10-01', '2026-11-03')).toEqual([]);
    });

    it('Evento único sem horário só aparece se o período cruza o intervalo', () => {
      const p = periodo({ periodicidade: 'EVENTO_UNICO', inicio: '2026-11-10', fim: '2026-11-12' });
      expect(gerarOcorrencias(p, '2026-11-13', '2026-11-20')).toEqual([]);
      expect(gerarOcorrencias(p, '2026-11-01', '2026-11-10')).toEqual([]);
      expect(gerarOcorrencias(p, '2026-11-12', '2026-11-20')).toHaveLength(1);
      expect(gerarOcorrencias(p, '2026-11-01', '2026-11-11')).toHaveLength(1);
    });
  });

  describe('RN-12.3: mensal começando no dia 31', () => {
    const p = periodo({ periodicidade: 'MENSAL', inicio: '2026-01-31', fim: '2026-06-30' });

    it('cai no último dia dos meses mais curtos', () => {
      expect(inicios(p, '2026-01-25', '2026-05-10')).toEqual([
        '2026-01-31',
        '2026-02-28',
        '2026-03-31',
        '2026-04-30',
      ]);
    });

    it('respeita ano bissexto', () => {
      const bissexto = periodo({
        periodicidade: 'MENSAL',
        inicio: '2027-12-31',
        fim: '2028-04-30',
      });
      expect(inicios(bissexto, '2028-02-01', '2028-03-15')).toEqual(['2028-02-29']);
    });

    it('dia 30 em fevereiro também vai para o último dia', () => {
      const dia30 = periodo({ periodicidade: 'MENSAL', inicio: '2026-01-30', fim: '2026-04-30' });
      expect(inicios(dia30, '2026-02-01', '2026-03-31')).toEqual(['2026-02-28', '2026-03-30']);
    });
  });
});

describe('validarIntervalo (RN-12.4)', () => {
  const campos = (de: string, ate: string) => {
    try {
      validarIntervalo(de, ate);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidacaoError);
      return (e as ValidacaoError).campos;
    }
    return null;
  };

  it('aceita até 62 dias', () => {
    expect(MAXIMO_DIAS_INTERVALO).toBe(62);
    expect(campos('2026-11-01', '2026-11-02')).toBeNull();
    expect(campos('2026-11-01', '2027-01-02')).toBeNull();
  });

  it('recusa mais de 62 dias', () => {
    expect(campos('2026-11-01', '2027-01-03')).toEqual({
      ate: 'O intervalo deve ter no máximo 62 dias.',
    });
  });

  it('recusa de >= ate', () => {
    const esperado = { ate: 'A data final deve ser posterior à data inicial.' };
    expect(campos('2026-11-10', '2026-11-10')).toEqual(esperado);
    expect(campos('2026-11-10', '2026-11-09')).toEqual(esperado);
  });

  it('recusa datas inválidas, indicando o campo', () => {
    expect(Object.keys(campos('2026-02-30', '2026-03-10') ?? {})).toEqual(['de']);
    expect(Object.keys(campos('2026-03-01', 'amanhã') ?? {})).toEqual(['ate']);
    expect(Object.keys(campos('x', 'y') ?? {})).toEqual(['de', 'ate']);
    expect(Object.keys(campos('2026-13-01', '2026-03-10') ?? {})).toEqual(['de']);
  });
});

describe('datas (UTC)', () => {
  it('converte ida e volta, sem depender do fuso', () => {
    expect(numeroParaDia(diaParaNumero('2026-03-08') as number)).toBe('2026-03-08');
    expect(numeroParaDia(diaParaNumero('0999-01-01') as number)).toBe('0999-01-01');
  });

  it('soma dias atravessando mês, ano e horário de verão', () => {
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(somarDias('2026-11-01', 7)).toBe('2026-11-08');
  });

  it('somarDias recusa data inválida', () => {
    expect(() => somarDias('2026-02-31', 1)).toThrow(RangeError);
  });

  it('dia do mês e dias no mês', () => {
    const n = diaParaNumero('2028-02-10') as number;
    expect(diaDoMes(n)).toBe(10);
    expect(diasNoMes(n)).toBe(29);
    expect(diasNoMes(diaParaNumero('2026-02-10') as number)).toBe(28);
  });
});
