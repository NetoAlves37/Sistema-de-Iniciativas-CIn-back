import type { Clock } from '@/shared/domain/clock';
import type { TransacaoPort } from '@/shared/domain/transacao.port';
import { IniciativaDuplicadaError } from '../../domain/errors/iniciativas.errors';
import { Iniciativa } from '../../domain/iniciativa';
import type { IniciativaRepository } from '../../domain/ports/iniciativa.repository';
import type { PrazosConfig } from '../../domain/ports/prazos-config';
import type { TipoRepository } from '../../domain/ports/tipo.repository';
import { DadosIniciativa } from '../../domain/value-objects/dados-iniciativa';
import type { DadosIniciativaInput } from '../dto/iniciativa.dto';
import type { EventosPort } from '../ports/eventos.port';

/**
 * RN-01 a RN-03. O tipo tem de ser um dos tipos ativos do cadastro. O mesmo autor não pode
 * repetir a submissão: título, data e horário de início iguais aos de uma iniciativa ativa
 * dele dão 409 (`IniciativaDuplicadaError`).
 */
export class SubmeterIniciativa {
  constructor(
    private readonly repositorio: IniciativaRepository,
    private readonly transacao: TransacaoPort,
    private readonly eventos: EventosPort,
    private readonly clock: Clock,
    private readonly prazos: PrazosConfig,
    private readonly tipos: Pick<TipoRepository, 'codigosAtivos'>,
  ) {}

  /** Devolve o id da iniciativa criada. */
  async executar(autorId: string, entrada: DadosIniciativaInput): Promise<string> {
    const ativos = new Set(await this.tipos.codigosAtivos());
    const dados = DadosIniciativa.criar(entrada, ativos);
    const iniciativa = Iniciativa.submeter(
      dados,
      autorId,
      entrada.comVotacao ?? true,
      this.clock,
      this.prazos,
    );
    await this.transacao.run(async () => {
      const duplicada = await this.repositorio.existeAtivaIgual({
        autorId,
        titulo: dados.titulo,
        inicio: dados.inicio,
        horaInicio: dados.horaInicio,
      });
      if (duplicada) throw new IniciativaDuplicadaError();
      await this.repositorio.criar(iniciativa);
    });
    this.eventos.publicar(iniciativa.pullEvents());
    return iniciativa.id;
  }
}
