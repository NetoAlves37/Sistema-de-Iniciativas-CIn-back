import { type DadosGoogleAgenda, googleAgendaUrl } from './google-agenda-url';

/**
 * Os valores esperados foram gerados executando `gcalUrl()` do protótipo (docs/prototipo.html)
 * em Node, com os mesmos dados. As partes que se repetem em todas as URLs estão em
 * constantes; o resto de cada URL é literal.
 */
const ANTES_DE_DATES =
  'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Oficina+de+Python+%26+Dados&dates=';
const DEPOIS_DE_DATES =
  '&ctz=America%2FRecife&details=Introdu%C3%A7%C3%A3o+pr%C3%A1tica%3A+la%C3%A7os%2C+listas+e+gr%C3%A1ficos.%0A%0AOrganizadores%3A+Ana+Souza%2C+Bruno+Lima%0AIniciativa+aprovada+no+Sistema+de+Iniciativas+do+CIn%2FUFPE.&location=Sala+E122%2C+Centro+de+Inform%C3%A1tica+-+UFPE';

const url = (dates: string, recur = '') =>
  `${ANTES_DE_DATES}${dates}${DEPOIS_DE_DATES}${recur ? `&recur=${recur}` : ''}`;

const dados = (parcial: Partial<DadosGoogleAgenda>): DadosGoogleAgenda => ({
  titulo: 'Oficina de Python & Dados',
  resumo: 'Introdução prática: laços, listas e gráficos.',
  inicio: '2026-11-10',
  fim: '2026-11-10',
  horaInicio: null,
  horaFim: null,
  periodicidade: 'EVENTO_UNICO',
  espaco: 'Sala E122',
  organizadores: 'Ana Souza, Bruno Lima',
  ...parcial,
});

describe('googleAgendaUrl (HU-20)', () => {
  it('GCAL.1: dia inteiro simples (Evento único de um dia), sem recorrência', () => {
    expect(googleAgendaUrl(dados({}))).toBe(url('20261110%2F20261111'));
  });

  it('GCAL.1: Evento único de vários dias sem horário termina em fim + 1 e não repete', () => {
    expect(googleAgendaUrl(dados({ fim: '2026-11-12' }))).toBe(url('20261110%2F20261113'));
  });

  it('GCAL.2: com horário, no dia do início', () => {
    expect(googleAgendaUrl(dados({ horaInicio: '14:00', horaFim: '16:30' }))).toBe(
      url('20261110T140000%2F20261110T163000'),
    );
  });

  it('GCAL.3: Diária de vários dias, dia inteiro, repete até o fim', () => {
    expect(googleAgendaUrl(dados({ periodicidade: 'DIARIA', fim: '2026-11-14' }))).toBe(
      url('20261110%2F20261111', 'RRULE%3AFREQ%3DDAILY%3BUNTIL%3D20261114'),
    );
  });

  it('GCAL.4: Semanal com horário', () => {
    expect(
      googleAgendaUrl(
        dados({
          periodicidade: 'SEMANAL',
          fim: '2026-12-22',
          horaInicio: '19:00',
          horaFim: '21:00',
        }),
      ),
    ).toBe(url('20261110T190000%2F20261110T210000', 'RRULE%3AFREQ%3DWEEKLY%3BUNTIL%3D20261222'));
  });

  it('GCAL.4: Quinzenal usa INTERVAL=2', () => {
    expect(googleAgendaUrl(dados({ periodicidade: 'QUINZENAL', fim: '2027-01-12' }))).toBe(
      url('20261110%2F20261111', 'RRULE%3AFREQ%3DWEEKLY%3BINTERVAL%3D2%3BUNTIL%3D20270112'),
    );
  });

  it('GCAL.4: Mensal com horário', () => {
    expect(
      googleAgendaUrl(
        dados({
          periodicidade: 'MENSAL',
          fim: '2027-03-10',
          horaInicio: '08:30',
          horaFim: '09:00',
        }),
      ),
    ).toBe(url('20261110T083000%2F20261110T090000', 'RRULE%3AFREQ%3DMONTHLY%3BUNTIL%3D20270310'));
  });

  it('GCAL.4: periodicidade recorrente de um dia só não gera recur', () => {
    expect(googleAgendaUrl(dados({ periodicidade: 'SEMANAL' }))).toBe(url('20261110%2F20261111'));
  });

  it('GCAL.5: Evento único de vários dias com horário vira FREQ=DAILY até o fim', () => {
    expect(
      googleAgendaUrl(dados({ fim: '2026-11-12', horaInicio: '09:00', horaFim: '11:00' })),
    ).toBe(url('20261110T090000%2F20261110T110000', 'RRULE%3AFREQ%3DDAILY%3BUNTIL%3D20261112'));
  });

  it('sem horário de fim, usa o horário de início (não quebra como o protótipo)', () => {
    expect(googleAgendaUrl(dados({ horaInicio: '14:00', horaFim: null }))).toBe(
      url('20261110T140000%2F20261110T140000'),
    );
  });
});
