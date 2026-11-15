/** Um tipo de iniciativa do cadastro (`GET /tipos-iniciativa`). */
export interface TipoIniciativaDto {
  id: number;
  /** Código estável, usado nas iniciativas e nos filtros (por exemplo `PALESTRA`). */
  code: string;
  nome: string;
  /** `#RRGGBB` */
  cor: string;
  ativo: boolean;
  /** Quantas iniciativas usam o tipo. Com alguma, ele não pode ser excluído. */
  iniciativas: number;
}

/** Corpo de `POST /tipos-iniciativa`. Validado no domínio (422 por campo). */
export interface CadastrarTipoInput {
  nome?: string;
  cor?: string;
}

/** Corpo de `PATCH /tipos-iniciativa/:id`: só os campos que mudam. */
export interface AlterarTipoInput {
  nome?: string;
  cor?: string;
  ativo?: boolean;
}

/** Quem faz a ação: precisa ser do comitê ou ADMIN; o nome vai para o log. */
export interface AtorTipoDto {
  id: string;
  nome: string;
  ehComite: boolean;
}
