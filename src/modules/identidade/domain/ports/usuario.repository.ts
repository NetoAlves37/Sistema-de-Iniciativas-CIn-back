import type { Usuario } from '../usuario';

export interface UsuarioRepository {
  /** Cria o usuário ou atualiza nome e perfil (upsert por id). */
  salvar(usuario: Usuario): Promise<void>;
  buscarPorId(id: string): Promise<Usuario | null>;
  buscarPorIds(ids: string[]): Promise<Usuario[]>;
}
