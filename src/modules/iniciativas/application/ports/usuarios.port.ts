export interface UsuarioResumo {
  id: string;
  nome: string;
  perfil: 'ALUNO' | 'PROFESSOR' | 'COMITE' | 'ADMIN';
}

/** Nomes e perfis de autores e decisores (implementada com o módulo `identidade`). */
export interface UsuariosPort {
  mapaPorIds(ids: string[]): Promise<Map<string, UsuarioResumo>>;
}
