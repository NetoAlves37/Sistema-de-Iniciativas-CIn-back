import { FakeClock } from '@/shared/testing/fake-clock';
import { UsuarioNaoEncontradoError } from '../domain/errors/identidade.errors';
import type { UsuarioRepository } from '../domain/ports/usuario.repository';
import { Usuario } from '../domain/usuario';
import { IdentidadeFacade } from './identidade.facade';

class UsuarioRepositoryEmMemoria implements UsuarioRepository {
  readonly usuarios = new Map<string, Usuario>();
  salvamentos = 0;

  async salvar(usuario: Usuario): Promise<void> {
    this.salvamentos++;
    this.usuarios.set(usuario.id, usuario);
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    return this.usuarios.get(id) ?? null;
  }

  async buscarPorIds(ids: string[]): Promise<Usuario[]> {
    return ids.flatMap((id) => this.usuarios.get(id) ?? []);
  }
}

describe('IdentidadeFacade', () => {
  const ana = { id: 'u-ana', nome: 'Ana Souza', perfil: 'ALUNO' };
  let repo: UsuarioRepositoryEmMemoria;
  let clock: FakeClock;
  let facade: IdentidadeFacade;

  beforeEach(() => {
    repo = new UsuarioRepositoryEmMemoria();
    clock = new FakeClock();
    facade = new IdentidadeFacade(repo, clock);
  });

  it('garantirUsuario cria o usuário na primeira requisição', async () => {
    await facade.garantirUsuario(ana);
    expect(await facade.obterPorId('u-ana')).toEqual(ana);
  });

  it('garantirUsuario não grava de novo enquanto nome e perfil não mudam (cache de 5 min)', async () => {
    await facade.garantirUsuario(ana);
    clock.advance(4 * 60 * 1000);
    await facade.garantirUsuario(ana);
    await facade.garantirUsuario(ana);
    expect(repo.salvamentos).toBe(1);
  });

  it('garantirUsuario regrava quando o cache de 5 minutos expira', async () => {
    await facade.garantirUsuario(ana);
    clock.advance(5 * 60 * 1000 + 1);
    await facade.garantirUsuario(ana);
    expect(repo.salvamentos).toBe(2);
  });

  it('garantirUsuario atualiza na hora quando o nome ou o perfil mudam no token', async () => {
    await facade.garantirUsuario(ana);
    await facade.garantirUsuario({ ...ana, nome: 'Ana Souza Lima' });
    await facade.garantirUsuario({ ...ana, nome: 'Ana Souza Lima', perfil: 'PROFESSOR' });
    expect(repo.salvamentos).toBe(3);
    expect(await facade.obterPorId('u-ana')).toMatchObject({
      nome: 'Ana Souza Lima',
      perfil: 'PROFESSOR',
    });
  });

  it('aceita o perfil ADMIN', async () => {
    await facade.garantirUsuario({ id: 'u-adm', nome: 'Admin', perfil: 'ADMIN' });
    expect((await facade.obterPorId('u-adm')).perfil).toBe('ADMIN');
  });

  it('obterPorId lança erro de domínio quando o usuário não existe', async () => {
    await expect(facade.obterPorId('inexistente')).rejects.toBeInstanceOf(
      UsuarioNaoEncontradoError,
    );
  });

  it('mapaPorIds devolve id → usuário e ignora ids desconhecidos e repetidos', async () => {
    await facade.garantirUsuario(ana);
    await facade.garantirUsuario({ id: 'u-bruno', nome: 'Bruno Lima', perfil: 'PROFESSOR' });
    const mapa = await facade.mapaPorIds(['u-ana', 'u-bruno', 'u-ana', 'u-x']);
    expect([...mapa.keys()]).toEqual(['u-ana', 'u-bruno']);
    expect(mapa.get('u-bruno')).toMatchObject({ nome: 'Bruno Lima', perfil: 'PROFESSOR' });
  });

  it('usuariosPorIds devolve os DTOs sem repetir ids', async () => {
    await facade.garantirUsuario(ana);
    expect(await facade.usuariosPorIds(['u-ana', 'u-ana'])).toEqual([ana]);
  });

  it('mapaPorIds com lista vazia não consulta o repositório', async () => {
    expect((await facade.mapaPorIds([])).size).toBe(0);
  });

  it('o cache de sincronização é limitado: ao estourar o limite, volta a gravar', async () => {
    await facade.garantirUsuario(ana);
    for (let i = 0; i < 5000; i++) {
      await facade.garantirUsuario({ id: `u-${i}`, nome: `Usuário ${i}`, perfil: 'ALUNO' });
    }
    const antes = repo.salvamentos;
    await facade.garantirUsuario(ana); // saiu do cache quando ele foi limpo
    expect(repo.salvamentos).toBe(antes + 1);
  });
});
