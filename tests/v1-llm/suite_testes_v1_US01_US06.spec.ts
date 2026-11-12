// ===== src/modules/divulgacao/application/calendario-us04.v1.spec.ts =====

import { describe, expect, it, vi } from 'vitest';
import { ListarOcorrencias } from './use-cases/listar-ocorrencias';

describe('US04 — calendário', () => {
  it('US04: consulta aprovadas e gera ocorrências com link Google Agenda', async () => {
    const iniciativa = { id:'i1', titulo:'Evento', tipo:'EVENTO', inicio:'2026-12-10', fim:'2026-12-10',
      horaInicio:'09:00', horaFim:'10:00', espaco:'Auditório', organizadores:'Org', periodicidade:'EVENTO_UNICO' };
    const port = { aprovadasParaCalendario: vi.fn().mockResolvedValue([iniciativa]) };
    const resultado = await new ListarOcorrencias(port as any).executar({de:'2026-12-01',ate:'2026-12-20',usuarioId:'u'});
    expect(port.aprovadasParaCalendario).toHaveBeenCalled();
    expect(resultado[0]).toMatchObject({iniciativaId:'i1',titulo:'Evento'});
    expect(resultado[0].googleAgendaUrl).toContain('calendar.google.com');
  });
  it('US04: rejeita intervalo inválido', async () => {
    const port = { aprovadasParaCalendario: vi.fn() };
    await expect(new ListarOcorrencias(port as any).executar({de:'2026-12-20',ate:'2026-12-01',usuarioId:'u'})).rejects.toThrow();
    expect(port.aprovadasParaCalendario).not.toHaveBeenCalled();
  });
  it('US04: iniciativas não aprovadas não são obtidas pela porta de calendário', async () => {
    const port = { aprovadasParaCalendario: vi.fn().mockResolvedValue([]) };
    const resultado = await new ListarOcorrencias(port as any).executar({de:'2026-12-01',ate:'2026-12-20',usuarioId:'u'});
    expect(resultado).toEqual([]);
  });
});


// ===== src/modules/refinamento/application/comentar-iniciativa-us06.v1.spec.ts =====

import { describe, expect, it, vi } from 'vitest';
import { FakeClock } from '@/shared/testing/fake-clock';
import { ComentarIniciativa } from './use-cases/comentar-iniciativa';
import { FaseDeSugestoesEncerradaError, IniciativaNaoEncontradaError } from '../domain/errors/refinamento.errors';

describe('US06 — comentários', () => {
  const estado = { id:'i1', ciclo:1, status:'EM_ANDAMENTO', autorId:'a' };
  const montar = (status: string | null = 'EM_ANDAMENTO') => {
    const comentarios = { salvar: vi.fn(async c => ({id:'c1', ...c})) };
    const iniciativas = { obterEstado: vi.fn(async () => status ? {...estado,status} : null) };
    const autores = { mapaPorIds: vi.fn(async () => new Map([['u',{nome:'Usuário'}]])) };
    return new ComentarIniciativa(comentarios as any, iniciativas as any, autores as any, new FakeClock(new Date('2026-11-12T12:00:00Z')));
  };
  it('US06: comenta em iniciativa válida durante EM_ANDAMENTO', async () => {
    const uc = montar();
    await expect(uc.executar({ iniciativaId:'i1', autorId:'u', texto:'  Sugestão  ' })).resolves.toMatchObject({texto:'Sugestão'});
  });
  it('US06: texto vazio é rejeitado', async () =>
    expect(montar().executar({iniciativaId:'i1',autorId:'u',texto:'  '})).rejects.toThrow());
  it('US06: texto acima do limite é rejeitado', async () =>
    expect(montar().executar({iniciativaId:'i1',autorId:'u',texto:'x'.repeat(2001)})).rejects.toThrow());
  it('US06: iniciativa inexistente é rejeitada', async () =>
    expect(montar(null).executar({iniciativaId:'nao',autorId:'u',texto:'Comentário'})).rejects.toThrow(IniciativaNaoEncontradaError));
  it.each(['EM_ANALISE','EM_VOTACAO','APROVADA','REPROVADA'] as const)(
    'US06: comentários bloqueados em %s', async status =>
      expect(montar(status).executar({iniciativaId:'i1',autorId:'u',texto:'Comentário'})).rejects.toThrow(FaseDeSugestoesEncerradaError));
});


// ===== src/modules/iniciativas/application/consultas-us03.v1.spec.ts =====

import { describe, expect, it, vi } from 'vitest';
import { ConsultasIniciativas } from './queries/consultas-iniciativas';

describe('US03 — consultas do painel', () => {
  // Particionamento de equivalência: filtro por status válido é encaminhado à leitura.
  it('US03: lista iniciativas com filtro e paginação', async () => {
    const leitura = { listar: vi.fn().mockResolvedValue({ linhas: [], total: 0 }) };
    const consultas = new ConsultasIniciativas({
      leitura, usuarios: {} as any, sugestoes: {} as any, votos: {} as any,
      googleAgenda: {} as any, carregar: {} as any, clock: {} as any,
    } as any);
    await consultas.listar({ status:'EM_ANALISE', page:1, limit:10 } as any);
    expect(leitura.listar).toHaveBeenCalledWith(expect.objectContaining({status:'EM_ANALISE',page:1,limit:10}));
  });
  it('US03: consulta minhas iniciativas e contagem por status', async () => {
    const leitura = {
      listar: vi.fn().mockResolvedValue({linhas:[],total:0}),
      contagemPorStatus: vi.fn().mockResolvedValue({EM_ANDAMENTO:2}),
    };
    const consultas = new ConsultasIniciativas({leitura, usuarios:{} as any, sugestoes:{} as any,
      votos:{} as any, googleAgenda:{} as any, carregar:{} as any, clock:{} as any} as any);
    await expect(consultas.minhas('autor',{page:1,limit:10})).resolves.toMatchObject({contagemPorStatus:{EM_ANDAMENTO:2}});
    expect(leitura.contagemPorStatus).toHaveBeenCalledWith('autor');
  });
});


// ===== src/modules/iniciativas/domain/iniciativa-us01-us05.v1.spec.ts =====

import { describe, expect, it } from 'vitest';
import { FakeClock } from '@/shared/testing/fake-clock';
import { dadosDeTeste, PRAZOS_PADRAO, umaIniciativa } from '@/shared/testing/builders/iniciativa.builder';
import { SomenteAutorError, TransicaoInvalidaError } from './errors/iniciativas.errors';
import { Iniciativa } from './iniciativa';

const clock = (d = '2026-11-12T12:00:00Z') => new FakeClock(new Date(d));

describe('US01 — submissão no domínio', () => {
  // Particionamento: criação válida; estado inicial esperado.
  it('US01: submete e inicia em EM_ANDAMENTO, ciclo 1', () => {
    const i = Iniciativa.submeter(dadosDeTeste(), 'autor', true, clock(), PRAZOS_PADRAO);
    expect(i.status).toBe('EM_ANDAMENTO');
    expect(i.ciclo).toBe(1);
    expect(i.autorId).toBe('autor');
  });
});

describe('US05 — edição e ressubmissão', () => {
  // Particionamento de equivalência: autor × status permitido.
  it('US05: autor edita durante EM_ANDAMENTO', () => {
    const i = umaIniciativa().doAutor('ana').construir();
    i.editar(dadosDeTeste({ titulo: 'Editado' }), true, 'ana', clock());
    expect(i.dados.titulo).toBe('Editado');
  });
  it('US05: usuário diferente não edita', () => {
    const i = umaIniciativa().doAutor('ana').construir();
    expect(() => i.editar(dadosDeTeste(), true, 'bia', clock())).toThrow(SomenteAutorError);
  });
  it.each(['EM_VOTACAO','EM_ANALISE','APROVADA','REPROVADA'] as const)(
    'US05: edição bloqueada no status %s', status => {
      const i = umaIniciativa().doAutor('ana').noStatus(status).construir();
      expect(() => i.editar(dadosDeTeste(), true, 'ana', clock())).toThrow(TransicaoInvalidaError);
    });
  it('US05: autor ressubmete reprovada, incrementa ciclo e reabre refinamento', () => {
    const i = umaIniciativa().doAutor('ana').reprovada().noCiclo(2).construir();
    i.ressubmeter(dadosDeTeste({ titulo: 'Revisada' }), true, 'ana', clock(), PRAZOS_PADRAO);
    expect(i.status).toBe('EM_ANDAMENTO');
    expect(i.ciclo).toBe(3);
    expect(i.dados.titulo).toBe('Revisada');
  });
  it('US05: ressubmissão sem alterações de conteúdo também é permitida', () => {
    const dados = dadosDeTeste();
    const i = umaIniciativa().doAutor('ana').reprovada().construir();
    i.ressubmeter(dados, true, 'ana', clock(), PRAZOS_PADRAO);
    expect(i.ciclo).toBe(2);
  });
  it('US05: usuário diferente não ressubmete', () => {
    const i = umaIniciativa().doAutor('ana').reprovada().construir();
    expect(() => i.ressubmeter(dadosDeTeste(), true, 'bia', clock(), PRAZOS_PADRAO)).toThrow(SomenteAutorError);
  });
  it.each(['EM_ANDAMENTO','EM_VOTACAO','EM_ANALISE','APROVADA'] as const)(
    'US05: ressubmissão bloqueada em %s', status => {
      const i = umaIniciativa().doAutor('ana').noStatus(status).construir();
      expect(() => i.ressubmeter(dadosDeTeste(), true, 'ana', clock(), PRAZOS_PADRAO)).toThrow(TransicaoInvalidaError);
    });
});


// ===== src/modules/iniciativas/domain/value-objects/dados-iniciativa.v1.spec.ts =====

import { describe, expect, it } from 'vitest';
import { DadosIniciativa, LIMITES } from './dados-iniciativa';
import { dadosValidos } from '@/shared/testing/builders/iniciativa.builder';

describe('US01 — validação dos dados da iniciativa', () => {
  // Particionamento de equivalência: conjunto de dados válido.
  it('US01-01: aceita uma iniciativa completa', () => {
    expect(() => DadosIniciativa.criar(dadosValidos())).not.toThrow();
  });

  // Particionamento: tipo fora do conjunto permitido.
  it('US01-02: rejeita tipo inválido', () => {
    expect(() => DadosIniciativa.criar(dadosValidos({ tipo: 'INVALIDO' }))).toThrow();
  });

  // Particionamento: campo obrigatório ausente/vazio.
  it.each(['titulo', 'resumo', 'detalhe', 'espaco', 'organizadores'] as const)(
    'US01: rejeita %s vazio',
    (campo) => expect(() => DadosIniciativa.criar(dadosValidos({ [campo]: '  ' }))).toThrow(),
  );

  // Valores-limite: máximo permitido e primeiro valor acima do máximo.
  it.each([
    ['titulo', LIMITES.titulo], ['resumo', LIMITES.resumo],
    ['detalhe', LIMITES.detalhe], ['espaco', LIMITES.espaco],
    ['organizadores', LIMITES.organizadores],
  ] as const)('US01: aceita %s no limite %i', (campo, limite) => {
    expect(() => DadosIniciativa.criar(dadosValidos({ [campo]: 'x'.repeat(limite) }))).not.toThrow();
  });
  it.each([
    ['titulo', LIMITES.titulo], ['resumo', LIMITES.resumo],
    ['detalhe', LIMITES.detalhe], ['espaco', LIMITES.espaco],
    ['organizadores', LIMITES.organizadores],
  ] as const)('US01: rejeita %s acima do limite', (campo, limite) => {
    expect(() => DadosIniciativa.criar(dadosValidos({ [campo]: 'x'.repeat(limite + 1) }))).toThrow();
  });

  // Particionamento de equivalência para datas e horários válidos/inválidos.
  it.each(['2026-02-30', '10/12/2026', 'abc'])('US01: rejeita data inválida %s', (inicio) =>
    expect(() => DadosIniciativa.criar(dadosValidos({ inicio }))).toThrow());
  it('US01: rejeita término anterior ao início', () =>
    expect(() => DadosIniciativa.criar(dadosValidos({ inicio: '2026-12-11', fim: '2026-12-10' }))).toThrow());
  it.each([['25:00','26:00'], ['09:60','10:00'], ['09:00','09:00'], ['10:00','09:00']] as const)(
    'US01: rejeita horário inválido/incoerente %s-%s', (horaInicio, horaFim) =>
      expect(() => DadosIniciativa.criar(dadosValidos({ horaInicio, horaFim }))).toThrow());
  it('US01: rejeita horário informado pela metade', () =>
    expect(() => DadosIniciativa.criar(dadosValidos({ horaInicio: '09:00', horaFim: '' }))).toThrow());

  // Particionamento de equivalência: periodicidade não reconhecida.
  it('US01: rejeita periodicidade inválida', () =>
    expect(() => DadosIniciativa.criar(dadosValidos({ periodicidade: 'SEMANAL_INVALIDA' }))).toThrow());
  it('US01: rejeita participantes não inteiro, zero ou acima do máximo', () => {
    for (const participantes of [0, -1, 1.5, 'abc', LIMITES.participantesMax + 1])
      expect(() => DadosIniciativa.criar(dadosValidos({ participantes }))).toThrow();
  });
  // Valores-limite de participantes.
  it.each([1, LIMITES.participantesMax])('US01: aceita participantes no limite %i', (participantes) =>
    expect(() => DadosIniciativa.criar(dadosValidos({ participantes }))).not.toThrow());
});


// ===== src/modules/avaliacao/application/registrar-decisao-us02.v1.spec.ts =====

import { describe, expect, it, vi } from 'vitest';
import { RegistrarDecisao } from './use-cases/registrar-decisao';
import { AutorNaoPodeDecidirError, TransicaoInvalidaError } from '@/modules/iniciativas/domain/errors/iniciativas.errors';

describe('US02 — registrar decisão', () => {
  const detalhe = { id: 'id', status: 'APROVADA' } as any;
  it('US02: aprova e retorna detalhe atualizado', async () => {
    const port = { registrarDecisao: vi.fn().mockResolvedValue(undefined), detalhe: vi.fn().mockResolvedValue(detalhe) };
    const uc = new RegistrarDecisao(port as any);
    await expect(uc.executar({ iniciativaId:'id', resultado:'APROVADA', decisor:{id:'comite',nome:'Comitê'} })).resolves.toEqual(detalhe);
    expect(port.registrarDecisao).toHaveBeenCalledWith({ iniciativaId:'id', resultado:'APROVADA', justificativa:null, decisorId:'comite' });
  });
  it('US02: reprova com justificativa', async () => {
    const port = { registrarDecisao: vi.fn(), detalhe: vi.fn().mockResolvedValue(detalhe) };
    await new RegistrarDecisao(port as any).executar({ iniciativaId:'id', resultado:'REPROVADA', justificativa:'Ajustar', decisor:{id:'c',nome:'C'} });
    expect(port.registrarDecisao).toHaveBeenCalledWith(expect.objectContaining({resultado:'REPROVADA', justificativa:'Ajustar'}));
  });
  it('US02: reprovação sem justificativa é inválida', async () => {
    const port = { registrarDecisao: vi.fn(), detalhe: vi.fn() };
    await expect(new RegistrarDecisao(port as any).executar({ iniciativaId:'id', resultado:'REPROVADA', decisor:{id:'c',nome:'C'} })).rejects.toThrow();
    expect(port.registrarDecisao).not.toHaveBeenCalled();
  });
  // Particionamento de equivalência: erro de regra do agregado é propagado.
  it('US02: propaga bloqueio de autor avaliando própria iniciativa', async () => {
    const port = { registrarDecisao: vi.fn().mockRejectedValue(new AutorNaoPodeDecidirError()), detalhe: vi.fn() };
    await expect(new RegistrarDecisao(port as any).executar({ iniciativaId:'id', resultado:'APROVADA', decisor:{id:'autor',nome:'A'} })).rejects.toThrow(AutorNaoPodeDecidirError);
  });
  it('US02: propaga decisão fora de EM_ANALISE', async () => {
    const port = { registrarDecisao: vi.fn().mockRejectedValue(new TransicaoInvalidaError('EM_ANDAMENTO','decidir')), detalhe: vi.fn() };
    await expect(new RegistrarDecisao(port as any).executar({ iniciativaId:'id', resultado:'APROVADA', decisor:{id:'c',nome:'C'} })).rejects.toThrow(TransicaoInvalidaError);
  });
});
