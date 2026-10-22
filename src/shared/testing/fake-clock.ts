import type { Clock } from '../domain/clock';

/** Relógio controlável para testes. */
export class FakeClock implements Clock {
  private current: Date;

  constructor(inicial: Date = new Date('2026-01-01T12:00:00.000Z')) {
    this.current = new Date(inicial);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(data: Date): void {
    this.current = new Date(data);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  advanceDays(dias: number): void {
    this.advance(dias * 24 * 60 * 60 * 1000);
  }
}
