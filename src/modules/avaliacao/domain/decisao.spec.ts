import { ValidacaoError } from '@/shared/domain/domain-error';
import { validarDecisao } from './decisao';

const campos = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ValidacaoError);
    return (e as ValidacaoError).campos;
  }
  throw new Error('não lançou');
};

describe('validarDecisao', () => {
  it('RN-10.1: aprovar ignora a justificativa', () => {
    expect(validarDecisao('APROVADA', 'qualquer coisa')).toEqual({
      resultado: 'APROVADA',
      justificativa: null,
    });
    expect(validarDecisao('APROVADA', undefined).justificativa).toBeNull();
  });

  it('RN-10.2: reprovar com justificativa devolve o texto sem espaços nas pontas', () => {
    expect(validarDecisao('REPROVADA', '  Fora do escopo.  ')).toEqual({
      resultado: 'REPROVADA',
      justificativa: 'Fora do escopo.',
    });
  });

  it('RN-10.3: reprovar sem justificativa, vazia ou só com espaços é inválido', () => {
    const esperado = { justificativa: 'A justificativa é obrigatória para reprovar.' };
    expect(campos(() => validarDecisao('REPROVADA', undefined))).toEqual(esperado);
    expect(campos(() => validarDecisao('REPROVADA', null))).toEqual(esperado);
    expect(campos(() => validarDecisao('REPROVADA', '   \n '))).toEqual(esperado);
  });

  it('aceita 2000 caracteres e recusa 2001', () => {
    expect(validarDecisao('REPROVADA', 'a'.repeat(2000)).justificativa).toHaveLength(2000);
    expect(campos(() => validarDecisao('REPROVADA', 'a'.repeat(2001)))).toEqual({
      justificativa: 'A justificativa deve ter no máximo 2000 caracteres.',
    });
  });

  it('recusa resultado desconhecido', () => {
    expect(Object.keys(campos(() => validarDecisao('TALVEZ', 'x')))).toEqual(['resultado']);
  });
});
