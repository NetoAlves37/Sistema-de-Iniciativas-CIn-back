import { ValidacaoError } from '@/shared/domain/domain-error';
import { Comentario, MENSAGEM_TEXTO_LONGO, MENSAGEM_TEXTO_VAZIO, TEXTO_MAXIMO } from './comentario';
import {
  FaseDeSugestoesEncerradaError,
  IniciativaNaoEncontradaError,
} from './errors/refinamento.errors';

const dados = {
  iniciativaId: 'ini-1',
  ciclo: 2,
  autorId: 'u-1',
  criadoEm: new Date('2026-11-02T12:00:00Z'),
};

describe('Comentario', () => {
  it('RN-05.1: comentário válido é criado com o ciclo e o texto aparado', () => {
    const comentario = Comentario.criar({ ...dados, texto: '  Que tal um sábado?  ' });
    expect(comentario).toMatchObject({
      iniciativaId: 'ini-1',
      ciclo: 2,
      autorId: 'u-1',
      texto: 'Que tal um sábado?',
    });
    expect(comentario.criadoEm).toEqual(dados.criadoEm);
  });

  it.each(['', '   ', '\n\t '])('RN-05.2: texto vazio %j recebe ValidacaoError', (texto) => {
    const erro = capturar(() => Comentario.criar({ ...dados, texto }));
    expect(erro).toBeInstanceOf(ValidacaoError);
    expect((erro as ValidacaoError).campos).toEqual({ texto: MENSAGEM_TEXTO_VAZIO });
    expect((erro as ValidacaoError).tipo).toBe('validacao');
    expect(MENSAGEM_TEXTO_VAZIO).toBe('Escreva sua sugestão antes de enviar.');
  });

  it('RN-05.2: aceita 1 e 1000 caracteres, recusa 1001', () => {
    expect(Comentario.criar({ ...dados, texto: 'a' }).texto).toBe('a');
    expect(Comentario.criar({ ...dados, texto: 'a'.repeat(TEXTO_MAXIMO) }).texto).toHaveLength(
      1000,
    );
    const erro = capturar(() => Comentario.criar({ ...dados, texto: 'a'.repeat(1001) }));
    expect((erro as ValidacaoError).campos).toEqual({ texto: MENSAGEM_TEXTO_LONGO });
  });

  it('RN-05.2: o limite de 1000 conta depois do trim', () => {
    const texto = `  ${'a'.repeat(1000)}  `;
    expect(Comentario.criar({ ...dados, texto }).texto).toHaveLength(1000);
  });
});

describe('erros do refinamento', () => {
  it('RN-05.3: fase encerrada é um conflito com a mensagem do PROMPT', () => {
    const erro = new FaseDeSugestoesEncerradaError();
    expect(erro.tipo).toBe('conflito');
    expect(erro.code).toBe('FASE_SUGESTOES_ENCERRADA');
    expect(erro.message).toBe('A fase de sugestões terminou.');
  });

  it('iniciativa inexistente é nao_encontrado', () => {
    const erro = new IniciativaNaoEncontradaError();
    expect(erro.tipo).toBe('nao_encontrado');
    expect(erro.message).toBe('Iniciativa não encontrada.');
  });
});

function capturar(fn: () => unknown): unknown {
  try {
    fn();
  } catch (erro) {
    return erro;
  }
  throw new Error('esperava um erro');
}
