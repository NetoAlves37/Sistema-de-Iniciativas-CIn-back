/**
 * Vocabulário de iniciativa compartilhado entre módulos (fonte única, DT-01). Os módulos
 * `iniciativas` e `divulgacao` usam os mesmos códigos de tipo e de periodicidade; antes cada um
 * tinha a sua cópia, e nada avisava se elas divergissem. Fica em `shared/domain` porque um
 * módulo não pode importar o domínio do outro (regras 1 e 4 de `src/architecture.spec.ts`).
 *
 * As periodicidades também existem na tabela `iniciativas_periodicidades` (migration): uma
 * periodicidade nova continua exigindo mudar as duas, de forma coordenada.
 */

/**
 * Código de um tipo de iniciativa (por exemplo `PALESTRA`). Os tipos são um cadastro mantido
 * pelo comitê e pelo ADMIN (`TipoDeIniciativa`), então o código é texto no formato
 * `FORMATO_CODIGO_TIPO`; se ele existe e está ativo, quem confere é o caso de uso.
 */
export type TipoIniciativa = string;

/** Letras maiúsculas sem acento, dígitos e `_`, até 40 caracteres. */
export const FORMATO_CODIGO_TIPO = /^[A-Z0-9_]{1,40}$/;

export const PERIODICIDADES = ['EVENTO_UNICO', 'DIARIA', 'SEMANAL', 'QUINZENAL', 'MENSAL'] as const;
export type Periodicidade = (typeof PERIODICIDADES)[number];

export const ROTULO_PERIODICIDADE: Record<Periodicidade, string> = {
  EVENTO_UNICO: 'Evento único',
  DIARIA: 'Diária',
  SEMANAL: 'Semanal',
  QUINZENAL: 'Quinzenal',
  MENSAL: 'Mensal',
};
