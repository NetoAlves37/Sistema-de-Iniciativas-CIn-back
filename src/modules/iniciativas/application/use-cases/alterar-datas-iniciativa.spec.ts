import { umaIniciativa } from '@/modules/iniciativas/testing/builders/iniciativa.builder';
import { montar } from '@/modules/iniciativas/testing/montar-casos-de-uso';
import { ValidacaoError } from '@/shared/domain/domain-error';
import {
  IniciativaNaoEncontradaError,
  SomenteComiteError,
  TransicaoInvalidaError,
} from '../../domain/errors/iniciativas.errors';

const comite = { id: 'carla', nome: 'Carla', ehComite: true };
const aluno = { id: 'diego', nome: 'Diego', ehComite: false };

describe('AlterarDatasIniciativa', () => {
  it('o comitê muda datas e horários de uma aprovada, e o histórico guarda o antes e o depois', async () => {
    const { alterarDatas, repositorio, eventos } = montar();
    const base = umaIniciativa().doAutor('ana').aprovada().construir();
    repositorio.semear(base);

    await alterarDatas.executar(base.id, comite, {
      inicio: '2026-12-15',
      fim: '2026-12-16',
      horaInicio: '14:00',
      horaFim: '17:30',
    });

    const gravada = repositorio.persistida(base.id);
    expect(gravada.dados).toMatchObject({
      inicio: '2026-12-15',
      fim: '2026-12-16',
      horaInicio: '14:00',
      horaFim: '17:30',
      titulo: base.dados.titulo,
      periodicidade: base.dados.periodicidade,
    });
    expect(gravada.status).toBe('APROVADA');
    expect(repositorio.historico.at(-1)).toMatchObject({
      de: 'APROVADA',
      para: 'APROVADA',
      por: 'carla',
      nota: 'Datas alteradas: de 10/12/2026 a 11/12/2026, 09:00–18:00 para 15/12/2026 a 16/12/2026, 14:00–17:30',
    });
    expect(eventos.nomes()).toContain('DatasIniciativaAlteradas');
  });

  it('sem horários, a iniciativa passa a ser de dia inteiro', async () => {
    const { alterarDatas, repositorio } = montar();
    const base = umaIniciativa().aprovada().construir();
    repositorio.semear(base);

    await alterarDatas.executar(base.id, comite, {
      inicio: '2026-12-20',
      fim: '2026-12-20',
      horaInicio: null,
      horaFim: null,
    });

    const gravada = repositorio.persistida(base.id);
    expect(gravada.dados.horaInicio).toBeNull();
    expect(gravada.dados.horaFim).toBeNull();
    expect(repositorio.historico.at(-1)?.nota).toContain('para 20/12/2026 (dia inteiro)');
  });

  it('o autor que é do comitê também pode alterar as datas da própria iniciativa', async () => {
    const { alterarDatas, repositorio } = montar();
    const base = umaIniciativa().doAutor('carla').aprovada().construir();
    repositorio.semear(base);
    await alterarDatas.executar(base.id, comite, { inicio: '2026-12-12', fim: '2026-12-12' });
    expect(repositorio.persistida(base.id).dados.inicio).toBe('2026-12-12');
  });

  it('quem não é do comitê recebe 403', async () => {
    const { alterarDatas, repositorio } = montar();
    const base = umaIniciativa().aprovada().construir();
    repositorio.semear(base);
    await expect(
      alterarDatas.executar(base.id, aluno, { inicio: '2026-12-12', fim: '2026-12-12' }),
    ).rejects.toBeInstanceOf(SomenteComiteError);
  });

  it.each([
    ['EM_ANDAMENTO', umaIniciativa().emAndamento()],
    ['EM_ANALISE', umaIniciativa().emAnalise()],
    ['REPROVADA', umaIniciativa().reprovada()],
  ])('fora de APROVADA (%s) recebe 409', async (_status, builder) => {
    const { alterarDatas, repositorio } = montar();
    const base = builder.construir();
    repositorio.semear(base);
    const erro = await alterarDatas
      .executar(base.id, comite, { inicio: '2026-12-12', fim: '2026-12-12' })
      .catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(TransicaoInvalidaError);
    expect((erro as Error).message).toBe('Só iniciativas aprovadas podem ter as datas alteradas.');
  });

  it('datas e horários inválidos voltam como 422 por campo, sem gravar', async () => {
    const { alterarDatas, repositorio } = montar();
    const base = umaIniciativa().aprovada().construir();
    repositorio.semear(base);

    const erro = await alterarDatas
      .executar(base.id, comite, {
        inicio: '2026-12-15',
        fim: '2026-12-14',
        horaInicio: '10:00',
        horaFim: '09:00',
      })
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ValidacaoError);
    expect((erro as ValidacaoError).campos).toEqual({
      fim: 'A data de término deve ser igual ou posterior à de início.',
      horaFim: 'A hora de término deve ser posterior à de início.',
    });
    expect(repositorio.persistida(base.id).dados.inicio).toBe('2026-12-10');
  });

  it('iniciativa inexistente recebe 404', async () => {
    const { alterarDatas } = montar();
    await expect(
      alterarDatas.executar('nao-existe', comite, { inicio: '2026-12-12', fim: '2026-12-12' }),
    ).rejects.toBeInstanceOf(IniciativaNaoEncontradaError);
  });
});
