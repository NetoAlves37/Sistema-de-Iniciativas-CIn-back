import { describe, expect, it } from 'vitest';
import type { DetalheIniciativa } from '@/modules/avaliacao/application/dto/avaliacao.dto';
import type {
  DecisaoRegistrada,
  IniciativasPort,
} from '@/modules/avaliacao/application/ports/iniciativas.port';
import { RegistrarDecisao } from '@/modules/avaliacao/application/use-cases/registrar-decisao';
import {
  AutorNaoPodeDecidirError,
  TransicaoInvalidaError,
} from '@/modules/iniciativas/domain/errors/iniciativas.errors';
import { umaIniciativa } from '@/modules/iniciativas/testing/builders/iniciativa.builder';
import { montar } from '@/modules/iniciativas/testing/montar-casos-de-uso';
import { ValidacaoError } from '@/shared/domain/domain-error';

/* ===========================================================================
 * US02 - AVALIAÇÃO PELO CAMINHO REAL (lacuna L13)
 *
 * Por que este arquivo existe: na v1, os 4 testes de "reprovar sem justificativa" chamavam
 * DecidirIniciativa.executar direto. Mas a justificativa é validada ANTES, em
 * RegistrarDecisao -> validarDecisao (módulo avaliacao), que a v1 nunca recebeu. Aqui os
 * mesmos cenários passam por RegistrarDecisao, ligado ao agregado real (em memória).
 *
 * Montagem: RegistrarDecisao -> porta IniciativasPort (implementada aqui, só para os testes)
 * -> DecidirIniciativa -> Iniciativa.decidir -> repositório em memória.
 * ========================================================================= */

const decisor = { id: 'carla', nome: 'Carla Menezes' };

function montarAvaliacao() {
  const base = montar();
  const chamadas: DecisaoRegistrada[] = [];
  const iniciativas: IniciativasPort = {
    listarEmAnalise: async () => ({ items: [], total: 0 }),
    registrarDecisao: async (decisao) => {
      chamadas.push(decisao);
      await base.decidir.executar(
        decisao.iniciativaId,
        decisao.decisorId,
        decisao.resultado,
        decisao.justificativa,
      );
    },
    detalhe: async (id) => ({ id }) as unknown as DetalheIniciativa,
  };
  return { ...base, chamadas, registrar: new RegistrarDecisao(iniciativas) };
}

const emAnalise = (autorId = 'ana') =>
  umaIniciativa().comId('i1').doAutor(autorId).emAnalise().construir();

describe('US02 - RegistrarDecisao: reprovar sem justificativa (L13)', () => {
  it.each([undefined, null, '', '   ', '\n \t'])(
    'US02 reprovar com justificativa %j | Partição de Equivalência (classe inválida) | ValidacaoError',
    async (justificativa) => {
      // Requisito: US02 - Reprovar iniciativa sem justificativa
      // Técnica: Partição de Equivalência (undefined, null, vazio, só espaços, só quebras)
      // Esperado: ValidacaoError "A justificativa é obrigatória para reprovar.",
      //           nada é enviado a iniciativas e o status continua EM_ANALISE (lacuna L13)
      const { registrar, repositorio, chamadas } = montarAvaliacao();
      repositorio.semear(emAnalise());

      const erro = await registrar
        .executar({ iniciativaId: 'i1', resultado: 'REPROVADA', justificativa, decisor })
        .catch((e) => e);

      expect(erro).toBeInstanceOf(ValidacaoError);
      expect(erro.campos).toEqual({ justificativa: 'A justificativa é obrigatória para reprovar.' });
      expect(chamadas).toEqual([]);
      expect(repositorio.persistida('i1').status).toBe('EM_ANALISE');
    },
  );

  it('US02 reprovar com justificativa | Partição de Equivalência (REPROVADA válida) | REPROVADA com texto aparado', async () => {
    // Requisito: US02 - Reprovar iniciativa mediante avaliação negativa
    // Técnica: Partição de Equivalência (justificativa preenchida, com espaços nas pontas)
    // Esperado: status REPROVADA e justificativa gravada sem os espaços das pontas (L13)
    const { registrar, repositorio } = montarAvaliacao();
    repositorio.semear(emAnalise());

    await registrar.executar({
      iniciativaId: 'i1',
      resultado: 'REPROVADA',
      justificativa: '  Sem espaço disponível.  ',
      decisor,
    });

    expect(repositorio.persistida('i1')).toMatchObject({
      status: 'REPROVADA',
      justificativa: 'Sem espaço disponível.',
      decisorId: 'carla',
    });
  });

  it.each([
    [2000, 'válido'],
    [2001, 'inválido'],
  ])(
    'US02 justificativa com %i caracteres | Valor-Limite | %s',
    async (tamanho, resultado) => {
      // Requisito: US02 - Reprovar iniciativa (limite de tamanho da justificativa)
      // Técnica: Valor-Limite (2000 e 2001 caracteres)
      // Esperado: 2000 é aceita; 2001 gera ValidacaoError no campo justificativa
      // OBS: o limite de 2000 vem do código (RN-10); a matriz da Etapa 1 não o define (L13)
      const { registrar, repositorio } = montarAvaliacao();
      repositorio.semear(emAnalise());
      const justificativa = 'a'.repeat(tamanho);

      const tentativa = registrar.executar({
        iniciativaId: 'i1',
        resultado: 'REPROVADA',
        justificativa,
        decisor,
      });

      if (resultado === 'válido') {
        await tentativa;
        expect(repositorio.persistida('i1').justificativa).toBe(justificativa);
      } else {
        const erro = await tentativa.catch((e) => e);
        expect(erro).toBeInstanceOf(ValidacaoError);
        expect(erro.campos).toEqual({
          justificativa: 'A justificativa deve ter no máximo 2000 caracteres.',
        });
        expect(repositorio.persistida('i1').status).toBe('EM_ANALISE');
      }
    },
  );
});

describe('US02 - RegistrarDecisao: aprovação e demais regras pelo caminho real (L13)', () => {
  it('US02 aprovar sem justificativa | Partição de Equivalência (APROVADA) | APROVADA e justificativa nula', async () => {
    // Requisito: US02 - Aprovar iniciativa mediante aprovação do avaliador
    // Técnica: Partição de Equivalência (resultado APROVADA, sem justificativa)
    // Esperado: status APROVADA, decisor registrado e justificativa nula
    const { registrar, repositorio } = montarAvaliacao();
    repositorio.semear(emAnalise());

    await registrar.executar({ iniciativaId: 'i1', resultado: 'APROVADA', decisor });

    expect(repositorio.persistida('i1')).toMatchObject({
      status: 'APROVADA',
      decisorId: 'carla',
      justificativa: null,
    });
  });

  it('US02 aprovar com justificativa enviada | Partição de Equivalência (APROVADA) | justificativa ignorada', async () => {
    // Requisito: US02 - Aprovar iniciativa mediante aprovação do avaliador
    // Técnica: Partição de Equivalência (APROVADA com texto de justificativa)
    // Esperado: aprova e descarta a justificativa (RN-10: ignorada na aprovação)
    const { registrar, repositorio } = montarAvaliacao();
    repositorio.semear(emAnalise());

    await registrar.executar({
      iniciativaId: 'i1',
      resultado: 'APROVADA',
      justificativa: 'texto que deve ser ignorado',
      decisor,
    });

    expect(repositorio.persistida('i1')).toMatchObject({ status: 'APROVADA', justificativa: null });
  });

  it('US02 resultado desconhecido | Partição de Equivalência (classe inválida) | ValidacaoError em resultado', async () => {
    // Requisito: US02 - decisão deve ser aprovar ou reprovar
    // Técnica: Partição de Equivalência (valor fora de APROVADA e REPROVADA)
    // Esperado: ValidacaoError no campo resultado e nada gravado
    // OBS: partição extra, não prevista na matriz (L13)
    const { registrar, repositorio, chamadas } = montarAvaliacao();
    repositorio.semear(emAnalise());

    const erro = await registrar
      .executar({ iniciativaId: 'i1', resultado: 'TALVEZ', justificativa: 'x', decisor })
      .catch((e) => e);

    expect(erro).toBeInstanceOf(ValidacaoError);
    expect(Object.keys(erro.campos)).toEqual(['resultado']);
    expect(chamadas).toEqual([]);
    expect(repositorio.persistida('i1').status).toBe('EM_ANALISE');
  });

  it('US02 autor decide a própria iniciativa | Partição de Equivalência (autor = avaliador) | AutorNaoPodeDecidirError', async () => {
    // Requisito: US02 - Impedir autor de avaliar própria iniciativa
    // Técnica: Partição de Equivalência (autor = avaliador), pelo caminho real
    // Esperado: AutorNaoPodeDecidirError sobe intacto e o status continua EM_ANALISE (L13)
    const { registrar, repositorio } = montarAvaliacao();
    repositorio.semear(emAnalise('carla'));

    await expect(
      registrar.executar({ iniciativaId: 'i1', resultado: 'APROVADA', decisor }),
    ).rejects.toBeInstanceOf(AutorNaoPodeDecidirError);
    expect(repositorio.persistida('i1').status).toBe('EM_ANALISE');
  });

  it.each(['EM_ANDAMENTO', 'EM_VOTACAO', 'APROVADA', 'REPROVADA'] as const)(
    'US02 decidir iniciativa em %s | Partição de Equivalência (status inválido) | TransicaoInvalidaError',
    async (status) => {
      // Requisito: US02 - Impedir avaliação fora do status EM_ANALISE
      // Técnica: Partição de Equivalência (cada status diferente de EM_ANALISE)
      // Esperado: TransicaoInvalidaError e o status não muda (L13)
      const { registrar, repositorio } = montarAvaliacao();
      const construtor = umaIniciativa().comId('i1').doAutor('ana');
      const porStatus = {
        EM_ANDAMENTO: () => construtor.emAndamento(),
        EM_VOTACAO: () => construtor.emVotacao(),
        APROVADA: () => construtor.aprovada(),
        REPROVADA: () => construtor.reprovada(),
      };
      repositorio.semear(porStatus[status]().construir());

      await expect(
        registrar.executar({ iniciativaId: 'i1', resultado: 'APROVADA', decisor }),
      ).rejects.toBeInstanceOf(TransicaoInvalidaError);
      expect(repositorio.persistida('i1').status).toBe(status);
    },
  );

  it('US02 segunda decisão sobre a mesma iniciativa | Partição de Equivalência (estado final) | TransicaoInvalidaError', async () => {
    // Requisito: US02 - Iniciativa avaliada não fica disponível novamente para avaliação
    // Técnica: Partição de Equivalência (antes x depois da decisão), pelo caminho real
    // Esperado: depois de aprovada, uma nova decisão é recusada e o status continua APROVADA (L13)
    const { registrar, repositorio } = montarAvaliacao();
    repositorio.semear(emAnalise());

    await registrar.executar({ iniciativaId: 'i1', resultado: 'APROVADA', decisor });

    await expect(
      registrar.executar({
        iniciativaId: 'i1',
        resultado: 'REPROVADA',
        justificativa: 'Mudei de ideia.',
        decisor: { id: 'elisa', nome: 'Elisa' },
      }),
    ).rejects.toBeInstanceOf(TransicaoInvalidaError);
    expect(repositorio.persistida('i1')).toMatchObject({ status: 'APROVADA', decisorId: 'carla' });
  });
});
