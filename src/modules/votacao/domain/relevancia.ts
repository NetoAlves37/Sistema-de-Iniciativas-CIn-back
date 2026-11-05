/** Quantil de 97,5% da normal padrão (intervalo de confiança de 95%). */
const Z = 1.96;

/**
 * Limite inferior do intervalo de Wilson para a proporção de votos positivos (RN-08).
 * Sem votos, a relevância é 0.
 */
export function wilson(positivos: number, total: number): number {
  if (total === 0) return 0;
  const p = positivos / total;
  const z2 = Z * Z;
  const centro = p + z2 / (2 * total);
  const margem = Z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  return (centro - margem) / (1 + z2 / total);
}

export interface ItemParaRelevancia {
  id: string;
  likes: number;
  dislikes: number;
  criadaEm: Date;
  /** Relevância já calculada (coluna do placar). Se ausente, é calculada de likes/dislikes. */
  relevancia?: number;
}

export const relevanciaDe = (
  item: Pick<ItemParaRelevancia, 'likes' | 'dislikes' | 'relevancia'>,
): number => item.relevancia ?? wilson(item.likes, item.likes + item.dislikes);

/**
 * Comparador para `Array.sort`: negativo se `a` vem antes de `b`. Maior relevância; depois
 * mais votos totais; depois `criadaEm` mais antiga; depois `id` (ordem determinística).
 */
export function compararRelevancia(a: ItemParaRelevancia, b: ItemParaRelevancia): number {
  const porRelevancia = relevanciaDe(b) - relevanciaDe(a);
  if (porRelevancia !== 0) return porRelevancia;
  const porVotos = b.likes + b.dislikes - (a.likes + a.dislikes);
  if (porVotos !== 0) return porVotos;
  const porData = a.criadaEm.getTime() - b.criadaEm.getTime();
  if (porData !== 0) return porData;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}
