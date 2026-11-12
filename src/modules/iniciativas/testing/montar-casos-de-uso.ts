import type { DadosIniciativaInput } from '@/modules/iniciativas/application/dto/iniciativa.dto';
import type { EventosPort } from '@/modules/iniciativas/application/ports/eventos.port';
import type { TransacaoPort } from '@/modules/iniciativas/application/ports/transacao.port';
import { AlterarIniciativa } from '@/modules/iniciativas/application/use-cases/alterar-iniciativa';
import { AplicarPrazosVencidos } from '@/modules/iniciativas/application/use-cases/aplicar-prazos-vencidos';
import { CarregarComPrazos } from '@/modules/iniciativas/application/use-cases/carregar-com-prazos';
import { DecidirIniciativa } from '@/modules/iniciativas/application/use-cases/decidir-iniciativa';
import { EditarIniciativa } from '@/modules/iniciativas/application/use-cases/editar-iniciativa';
import { RessubmeterIniciativa } from '@/modules/iniciativas/application/use-cases/ressubmeter-iniciativa';
import { SubmeterIniciativa } from '@/modules/iniciativas/application/use-cases/submeter-iniciativa';
import type { DomainEvent } from '@/shared/domain/domain-event';
import { FakeClock } from '@/shared/testing/fake-clock';
import { dadosValidos, PRAZOS_PADRAO } from './builders/iniciativa.builder';
import { IniciativaRepositoryEmMemoria } from './in-memory/in-memory-iniciativa.repository';

/** Montagem comum dos testes dos casos de uso de `iniciativas` (sem banco). */

export const DIA = 24 * 60 * 60 * 1000;
export const T0 = new Date('2026-11-02T12:00:00.000Z');

class EventosEmMemoria implements EventosPort {
  publicados: DomainEvent[] = [];
  publicar(eventos: DomainEvent[]): void {
    this.publicados.push(...eventos);
  }
  nomes(): string[] {
    return this.publicados.map((e) => e.constructor.name);
  }
}

const transacaoSimples: TransacaoPort = { run: (trabalho) => trabalho() };

export function montar() {
  const repositorio = new IniciativaRepositoryEmMemoria();
  const clock = new FakeClock(T0);
  const eventos = new EventosEmMemoria();
  const carregar = new CarregarComPrazos(
    repositorio,
    transacaoSimples,
    eventos,
    clock,
    PRAZOS_PADRAO,
  );
  const alterar = new AlterarIniciativa(repositorio, transacaoSimples, eventos, carregar);
  const submeter = new SubmeterIniciativa(
    repositorio,
    transacaoSimples,
    eventos,
    clock,
    PRAZOS_PADRAO,
  );
  const editar = new EditarIniciativa(alterar, clock);
  const ressubmeter = new RessubmeterIniciativa(alterar, clock, PRAZOS_PADRAO);
  const decidir = new DecidirIniciativa(alterar, clock);
  const job = new AplicarPrazosVencidos(repositorio, carregar, clock);
  return { repositorio, clock, eventos, carregar, submeter, editar, ressubmeter, decidir, job };
}

export const entrada = (sobrescritas: Partial<DadosIniciativaInput> = {}): DadosIniciativaInput =>
  ({ ...dadosValidos(), ...sobrescritas }) as DadosIniciativaInput;
