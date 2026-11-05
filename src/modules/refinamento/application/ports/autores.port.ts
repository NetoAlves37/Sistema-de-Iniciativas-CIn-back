export interface AutorInfo {
  id: string;
  nome: string;
  perfil: string;
}

/** Porta para o módulo `identidade`. */
export interface AutoresPort {
  mapaPorIds(ids: string[]): Promise<Map<string, AutorInfo>>;
}
