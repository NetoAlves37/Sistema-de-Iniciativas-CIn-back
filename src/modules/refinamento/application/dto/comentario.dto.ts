import type { ComentarioPersistido } from '../../domain/ports/comentario.repository';
import type { AutorInfo } from '../ports/autores.port';

export type PerfilAutor = 'ALUNO' | 'PROFESSOR' | 'COMITE' | 'ADMIN';

export interface ComentarioDto {
  id: string;
  ciclo: number;
  autor: { id: string; nome: string; perfil: PerfilAutor; ehAutorDaIniciativa: boolean };
  texto: string;
  /** ISO 8601 */
  criadoEm: string;
}

export interface PaginaDeComentariosDto {
  items: ComentarioDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const LIMITE_PADRAO_COMENTARIOS = 50;

export function paraComentarioDto(
  comentario: ComentarioPersistido,
  autores: Map<string, AutorInfo>,
  autorDaIniciativaId: string,
): ComentarioDto {
  const autor = autores.get(comentario.autorId);
  return {
    id: comentario.id,
    ciclo: comentario.ciclo,
    autor: {
      id: comentario.autorId,
      nome: autor?.nome ?? 'Usuário desconhecido',
      perfil: (autor?.perfil as PerfilAutor | undefined) ?? 'ALUNO',
      ehAutorDaIniciativa: comentario.autorId === autorDaIniciativaId,
    },
    texto: comentario.texto,
    criadoEm: comentario.criadoEm.toISOString(),
  };
}
