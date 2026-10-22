export enum AccessRole {
  /** Administrador da aplicação. Não decide iniciativas (isso é do comitê). */
  ADMIN = 'ADMIN',
  USER = 'USER',
  /** Comitê avaliador: fila de análise e decisão. */
  COMITE = 'COMITE',
}
