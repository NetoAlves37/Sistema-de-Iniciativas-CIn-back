/**
 * Usuários de teste. Os ids são fixos e **iguais aos do `setup/realm.json`** (campo `id` de
 * cada usuário), para que o seed, os testes e o Keycloak de desenvolvimento concordem.
 */
export interface UsuarioTeste {
  id: string;
  username: string;
  nome: string;
  /** Atributo `perfil` do Keycloak (`aluno` ou `professor`), quando existe. */
  atributoPerfil?: 'aluno' | 'professor';
  /** Roles de realm (sem o prefixo `sys_sistema-de-iniciativas-cin-`). */
  roles: Array<'users' | 'comite' | 'admin'>;
}

export const USUARIOS_TESTE = {
  ana: {
    id: '00000000-0000-4000-a000-000000000001',
    username: 'ana',
    nome: 'Ana Souza',
    atributoPerfil: 'aluno',
    roles: ['users'],
  },
  bruno: {
    id: '00000000-0000-4000-a000-000000000002',
    username: 'bruno',
    nome: 'Bruno Lima',
    atributoPerfil: 'professor',
    roles: ['users'],
  },
  carla: {
    id: '00000000-0000-4000-a000-000000000003',
    username: 'carla',
    nome: 'Carla Menezes',
    atributoPerfil: 'professor',
    roles: ['users', 'comite'],
  },
  diego: {
    id: '00000000-0000-4000-a000-000000000004',
    username: 'diego',
    nome: 'Diego Alves',
    atributoPerfil: 'aluno',
    roles: ['users'],
  },
  elisa: {
    id: '00000000-0000-4000-a000-000000000005',
    username: 'elisa',
    nome: 'Elisa Rocha',
    atributoPerfil: 'professor',
    roles: ['users', 'comite'],
  },
  admin: {
    id: '00000000-0000-4000-a000-000000000006',
    username: 'admin',
    nome: 'Admin Test',
    roles: ['admin', 'users'],
  },
  user: {
    id: '00000000-0000-4000-a000-000000000007',
    username: 'user',
    nome: 'User Test',
    roles: ['users'],
  },
} as const satisfies Record<string, UsuarioTeste>;

export type NomeUsuarioTeste = keyof typeof USUARIOS_TESTE;

export const PREFIXO_ROLE = 'sys_sistema-de-iniciativas-cin-';
