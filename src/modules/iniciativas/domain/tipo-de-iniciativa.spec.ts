import { ValidacaoError } from '@/shared/domain/domain-error';
import { codigoDoNome, normalizarNome, TipoDeIniciativa } from './tipo-de-iniciativa';

const nenhum = new Set<string>();

function camposComErro(acao: () => unknown): Record<string, string> {
  try {
    acao();
  } catch (erro) {
    if (erro instanceof ValidacaoError) return erro.campos;
    throw erro;
  }
  return {};
}

const umTipo = (props: Partial<{ nome: string; cor: string; ativo: boolean }> = {}) =>
  TipoDeIniciativa.reconstituir({
    id: 7,
    code: 'PALESTRA',
    nome: 'Palestra',
    cor: '#336699',
    ativo: true,
    ...props,
  });

describe('TipoDeIniciativa', () => {
  describe('normalizarNome e codigoDoNome', () => {
    it('ignoram acento, maiúsculas e espaços repetidos', () => {
      expect(normalizarNome('  Liga   Acadêmica ')).toBe('liga academica');
      expect(normalizarNome('LIGA ACADEMICA')).toBe(normalizarNome('liga acadêmica'));
    });

    it('o código tem só A-Z, 0-9 e _, e no máximo 34 caracteres (sobra espaço para sufixo)', () => {
      expect(codigoDoNome('Oficina de C++ & Rust')).toBe('OFICINA_DE_C_RUST');
      expect(codigoDoNome('Ç'.repeat(10))).toBe('CCCCCCCCCC');
      expect(codigoDoNome('a'.repeat(60))).toHaveLength(34);
    });
  });

  describe('criar', () => {
    it('nasce ativo, com nome aparado, cor em maiúsculas e o registro CRIADO pendente', () => {
      const tipo = TipoDeIniciativa.criar(
        { nome: '  Festival   de Música ', cor: '#ff00aa' },
        nenhum,
      );

      expect(tipo).toMatchObject({
        code: 'FESTIVAL_DE_MUSICA',
        nome: 'Festival de Música',
        cor: '#FF00AA',
        ativo: true,
      });
      expect(tipo.pullRegistros()).toEqual([
        {
          acao: 'CRIADO',
          antes: null,
          depois: { nome: 'Festival de Música', cor: '#FF00AA', ativo: true },
        },
      ]);
      expect(tipo.pullRegistros()).toEqual([]);
    });

    it('acrescenta sufixo enquanto o código já estiver em uso', () => {
      const tipo = TipoDeIniciativa.criar(
        { nome: 'Liga', cor: '#000000' },
        new Set(['LIGA', 'LIGA_2']),
      );
      expect(tipo.code).toBe('LIGA_3');
    });

    it.each([
      [{}, { nome: 'Informe o nome do tipo.', cor: 'Escolha a cor do tipo.' }],
      [{ nome: '   ', cor: '#000000' }, { nome: 'Informe o nome do tipo.' }],
      [
        { nome: 'x'.repeat(61), cor: '#000000' },
        { nome: 'O nome deve ter no máximo 60 caracteres.' },
      ],
      [{ nome: 'Liga', cor: '#12345' }, { cor: 'Informe a cor no formato #RRGGBB.' }],
      [{ nome: 'Liga', cor: 'red' }, { cor: 'Informe a cor no formato #RRGGBB.' }],
      [
        { nome: 42, cor: 7 },
        { nome: 'Informe o nome do tipo.', cor: 'Escolha a cor do tipo.' },
      ],
    ])('valida %j', (campos, erros) => {
      expect(camposComErro(() => TipoDeIniciativa.criar(campos, nenhum))).toEqual(erros);
    });

    it('aceita exatamente 60 caracteres', () => {
      expect(
        TipoDeIniciativa.criar({ nome: 'x'.repeat(60), cor: '#000000' }, nenhum).nome,
      ).toHaveLength(60);
    });
  });

  describe('alterar', () => {
    it('renomeia sem mudar o código e registra só o que mudou', () => {
      const tipo = umTipo();
      tipo.alterar({ nome: 'Palestra Magna' });
      expect(tipo.code).toBe('PALESTRA');
      expect(tipo.pullRegistros()).toEqual([
        { acao: 'ALTERADO', antes: { nome: 'Palestra' }, depois: { nome: 'Palestra Magna' } },
      ]);
    });

    it('troca só a cor', () => {
      const tipo = umTipo();
      tipo.alterar({ cor: '#aabbcc' });
      expect(tipo.cor).toBe('#AABBCC');
      expect(tipo.pullRegistros()).toEqual([
        { acao: 'ALTERADO', antes: { cor: '#336699' }, depois: { cor: '#AABBCC' } },
      ]);
    });

    it('sem mudança real (mesmo nome, cor em minúsculas) não registra nada', () => {
      const tipo = umTipo();
      tipo.alterar({ nome: ' Palestra ', cor: '#336699'.toLowerCase() });
      expect(tipo.pullRegistros()).toEqual([]);
    });

    it('valor inválido lança 422 e não muda nada', () => {
      const tipo = umTipo();
      expect(camposComErro(() => tipo.alterar({ nome: '' }))).toEqual({
        nome: 'Informe o nome do tipo.',
      });
      expect(tipo.nome).toBe('Palestra');
      expect(tipo.pullRegistros()).toEqual([]);
    });
  });

  describe('definirAtivo', () => {
    it('desativar e ativar registram DESATIVADO e ATIVADO', () => {
      const tipo = umTipo();
      tipo.definirAtivo(false);
      tipo.definirAtivo(true);
      expect(tipo.pullRegistros()).toEqual([
        { acao: 'DESATIVADO', antes: { ativo: true }, depois: { ativo: false } },
        { acao: 'ATIVADO', antes: { ativo: false }, depois: { ativo: true } },
      ]);
    });

    it('pedir o estado atual não registra nada', () => {
      const tipo = umTipo({ ativo: false });
      tipo.definirAtivo(false);
      expect(tipo.pullRegistros()).toEqual([]);
    });
  });

  it('registroDeExclusao guarda o estado final em `antes`', () => {
    expect(umTipo({ ativo: false }).registroDeExclusao()).toEqual({
      acao: 'EXCLUIDO',
      antes: { nome: 'Palestra', cor: '#336699', ativo: false },
      depois: null,
    });
  });
});
