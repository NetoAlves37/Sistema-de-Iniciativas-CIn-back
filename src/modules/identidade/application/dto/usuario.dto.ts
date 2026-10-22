import type { Perfil } from '../../domain/perfil';

export interface UsuarioDto {
  id: string;
  nome: string;
  perfil: Perfil;
}

export interface RegistrarUsuarioInput {
  id: string;
  nome: string;
  perfil: string;
}
