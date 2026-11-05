import { ValidacaoError } from '@/shared/domain/domain-error';
import { IniciativaNaoEncontradaError, VotacaoEncerradaError } from './errors/votacao.errors';
import { DISLIKE, decidirVoto, ehValorVoto, LIKE, validarValorVoto } from './voto';

describe('decidirVoto', () => {
  it('RN-07.1: sem voto anterior, registra', () => {
    expect(decidirVoto(0, LIKE)).toEqual({ meuVoto: 1, acao: 'REGISTRADO' });
    expect(decidirVoto(0, DISLIKE)).toEqual({ meuVoto: -1, acao: 'REGISTRADO' });
  });

  it('RN-07.2: valor oposto altera o voto', () => {
    expect(decidirVoto(1, DISLIKE)).toEqual({ meuVoto: -1, acao: 'ALTERADO' });
    expect(decidirVoto(-1, LIKE)).toEqual({ meuVoto: 1, acao: 'ALTERADO' });
  });

  it('RN-07.3: clicar no mesmo voto retira o voto', () => {
    expect(decidirVoto(1, LIKE)).toEqual({ meuVoto: 0, acao: 'RETIRADO' });
    expect(decidirVoto(-1, DISLIKE)).toEqual({ meuVoto: 0, acao: 'RETIRADO' });
  });
});

describe('valor do voto', () => {
  it('aceita só +1 e -1', () => {
    expect(ehValorVoto(1)).toBe(true);
    expect(ehValorVoto(-1)).toBe(true);
    for (const invalido of [0, 2, '1', null, undefined, true, 0.5]) {
      expect(ehValorVoto(invalido)).toBe(false);
    }
  });

  it('validarValorVoto devolve o valor ou lança ValidacaoError({ valor })', () => {
    expect(validarValorVoto(1)).toBe(1);
    expect(validarValorVoto(-1)).toBe(-1);
    try {
      validarValorVoto(0);
      expect.unreachable();
    } catch (erro) {
      expect(erro).toBeInstanceOf(ValidacaoError);
      expect((erro as ValidacaoError).campos).toHaveProperty('valor');
    }
  });
});

describe('erros da votação', () => {
  it('RN-07.5: votação encerrada é conflito, com a mensagem do PROMPT', () => {
    const erro = new VotacaoEncerradaError();
    expect(erro.tipo).toBe('conflito');
    expect(erro.code).toBe('VOTACAO_ENCERRADA');
    expect(erro.message).toBe('A votação desta iniciativa foi encerrada.');
  });

  it('iniciativa inexistente é nao_encontrado', () => {
    const erro = new IniciativaNaoEncontradaError();
    expect(erro.tipo).toBe('nao_encontrado');
    expect(erro.message).toBe('Iniciativa não encontrada.');
  });
});
