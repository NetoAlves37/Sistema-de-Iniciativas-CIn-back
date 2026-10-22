import { compararRelevancia, type ItemParaRelevancia, relevanciaDe, wilson } from './relevancia';

/** Referência independente: intervalo de Wilson escrito de outra forma (limite inferior). */
function wilsonReferencia(pos: number, n: number): number {
  if (n === 0) return 0;
  const z = 1.96;
  const phat = pos / n;
  const denominador = 1 + (z * z) / n;
  const centro = phat + (z * z) / (2 * n);
  const desvio = z * Math.sqrt((phat * (1 - phat)) / n + (z * z) / (4 * n * n));
  return (centro - desvio) / denominador;
}

describe('wilson', () => {
  it('RN-08.1: sem votos, o valor é 0', () => {
    expect(wilson(0, 0)).toBe(0);
    expect(relevanciaDe({ likes: 0, dislikes: 0 })).toBe(0);
  });

  it.each([
    [34, 37],
    [9, 20],
    [6, 6],
  ])('RN-08.2: wilson(%i, %i) confere com a referência independente (1e-9)', (pos, n) => {
    expect(Math.abs(wilson(pos, n) - wilsonReferencia(pos, n))).toBeLessThan(1e-9);
  });

  it('RN-08.2: valores conhecidos arredondados como na tela', () => {
    expect(Math.round(wilson(34, 37) * 100)).toBe(79);
    expect(Math.round(wilson(9, 20) * 100)).toBe(26);
    expect(Math.round(wilson(6, 6) * 100)).toBe(61);
  });

  it('só dislikes dá relevância próxima de 0 e nunca negativa', () => {
    expect(wilson(0, 10)).toBeGreaterThanOrEqual(0);
    expect(wilson(0, 10)).toBeLessThan(0.01);
  });

  it('mais votos com a mesma proporção dão relevância maior', () => {
    expect(wilson(30, 30)).toBeGreaterThan(wilson(3, 3));
  });
});

describe('compararRelevancia', () => {
  const item = (
    id: string,
    likes: number,
    dislikes: number,
    criada: string,
  ): ItemParaRelevancia => ({
    id,
    likes,
    dislikes,
    criadaEm: new Date(criada),
  });
  const ordenar = (itens: ItemParaRelevancia[]) =>
    [...itens].sort(compararRelevancia).map((i) => i.id);

  it('maior relevância primeiro', () => {
    const a = item('a', 6, 6, '2026-01-01');
    const b = item('b', 20, 1, '2026-01-02');
    expect(ordenar([a, b])).toEqual(['b', 'a']);
  });

  it('RN-08.3: empate de relevância é desempatado pelo total de votos', () => {
    const poucos = { ...item('a', 3, 0, '2026-01-01'), relevancia: 0.5 };
    const muitos = { ...item('b', 30, 10, '2026-01-02'), relevancia: 0.5 };
    expect(ordenar([poucos, muitos])).toEqual(['b', 'a']);
    expect(ordenar([muitos, poucos])).toEqual(['b', 'a']);
  });

  it('usa a relevância informada em vez de recalculá-la', () => {
    const forte = { ...item('a', 0, 5, '2026-01-01'), relevancia: 0.99 };
    const fraco = item('b', 50, 0, '2026-01-01');
    expect(ordenar([fraco, forte])).toEqual(['a', 'b']);
  });

  it('RN-08.4: empate em relevância e votos é desempatado pela criação mais antiga', () => {
    const antiga = item('b', 5, 1, '2026-01-01T10:00:00Z');
    const nova = item('a', 5, 1, '2026-01-02T10:00:00Z');
    expect(ordenar([nova, antiga])).toEqual(['b', 'a']);
  });

  it('desempata por id quando tudo mais é igual, e é determinístico', () => {
    const x = item('x', 5, 1, '2026-01-01');
    const y = item('y', 5, 1, '2026-01-01');
    expect(ordenar([y, x])).toEqual(['x', 'y']);
    expect(ordenar([x, y])).toEqual(['x', 'y']);
    expect(compararRelevancia(x, { ...x })).toBe(0);
  });
});
