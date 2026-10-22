import { SystemClock } from '../infrastructure/system-clock';
import { FakeClock } from './fake-clock';

describe('Clock', () => {
  it('SystemClock devolve o instante atual', () => {
    const antes = Date.now();
    const agora = new SystemClock().now().getTime();
    expect(agora).toBeGreaterThanOrEqual(antes);
    expect(agora).toBeLessThanOrEqual(Date.now());
  });

  it('FakeClock é controlável e devolve cópias', () => {
    const relogio = new FakeClock(new Date('2026-03-01T00:00:00.000Z'));
    expect(relogio.now().toISOString()).toBe('2026-03-01T00:00:00.000Z');

    relogio.advanceDays(3);
    expect(relogio.now().toISOString()).toBe('2026-03-04T00:00:00.000Z');

    relogio.set(new Date('2026-12-31T23:59:00.000Z'));
    expect(relogio.now().toISOString()).toBe('2026-12-31T23:59:00.000Z');

    relogio.now().setFullYear(1999);
    expect(relogio.now().getUTCFullYear()).toBe(2026);
  });
});
