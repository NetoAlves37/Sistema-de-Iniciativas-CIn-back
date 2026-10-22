import { UsuarioInvalidoError } from './errors/identidade.errors';
import { Usuario } from './usuario';

describe('Usuario', () => {
  const id = '3b8c9a52-4c0a-4d3a-9c53-7d3c0f2a1111';

  it('cria o usuário com nome e perfil válidos, aparando espaços', () => {
    const usuario = Usuario.criar({ id, nome: '  Ana Souza ', perfil: 'ALUNO' });
    expect(usuario.id).toBe(id);
    expect(usuario.nome).toBe('Ana Souza');
    expect(usuario.perfil).toBe('ALUNO');
  });

  it.each(['ALUNO', 'PROFESSOR', 'COMITE', 'ADMIN'])('aceita o perfil %s', (perfil) => {
    expect(Usuario.criar({ id, nome: 'Ana', perfil }).perfil).toBe(perfil);
  });

  it('rejeita identificador, nome ou perfil inválidos', () => {
    expect(() => Usuario.criar({ id: ' ', nome: 'Ana', perfil: 'ALUNO' })).toThrow(
      UsuarioInvalidoError,
    );
    expect(() => Usuario.criar({ id, nome: '  ', perfil: 'ALUNO' })).toThrow(UsuarioInvalidoError);
    expect(() => Usuario.criar({ id, nome: 'Ana', perfil: 'VISITANTE' })).toThrow(
      UsuarioInvalidoError,
    );
  });

  it('o erro de domínio carrega um code estável', () => {
    try {
      Usuario.criar({ id, nome: '', perfil: 'ALUNO' });
    } catch (error) {
      expect((error as UsuarioInvalidoError).code).toBe('USUARIO_INVALIDO');
    }
  });

  it('equals compara id, nome e perfil', () => {
    const a = Usuario.criar({ id, nome: 'Ana', perfil: 'ALUNO' });
    expect(a.equals(Usuario.criar({ id, nome: 'Ana', perfil: 'ALUNO' }))).toBe(true);
    expect(a.equals(Usuario.criar({ id, nome: 'Ana', perfil: 'PROFESSOR' }))).toBe(false);
    expect(a.equals(Usuario.criar({ id, nome: 'Ana B', perfil: 'ALUNO' }))).toBe(false);
  });
});
