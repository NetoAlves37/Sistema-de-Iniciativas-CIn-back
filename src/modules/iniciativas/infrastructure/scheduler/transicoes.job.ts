import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { IniciativasFacade } from '../../application/iniciativas.facade';

/**
 * Job das transições por prazo (RN-06). A expressão cron e o fuso vêm do ambiente
 * (`TRANSICOES_CRON`, `APP_TIMEZONE`), lidos quando o módulo é carregado: `main.ts` carrega
 * o `.env` antes de importar a aplicação. Cada transição é idempotente e segura com várias
 * instâncias (concorrência otimista na iniciativa).
 */
@Injectable()
export class TransicoesJob {
  private readonly logger = new Logger(TransicoesJob.name);
  private emExecucao = false;

  constructor(private readonly iniciativas: IniciativasFacade) {}

  @Cron(process.env.TRANSICOES_CRON?.trim() || '*/1 * * * *', {
    name: 'iniciativas-transicoes',
    timeZone: process.env.APP_TIMEZONE?.trim() || 'America/Recife',
  })
  async executar(): Promise<void> {
    if (this.emExecucao) return;
    this.emExecucao = true;
    try {
      const processadas = await this.iniciativas.aplicarPrazosVencidos();
      if (processadas > 0)
        this.logger.log(`${processadas} iniciativa(s) com prazo vencido processada(s).`);
    } catch (erro) {
      this.logger.error(
        'Falha ao aplicar as transições por prazo.',
        erro instanceof Error ? erro.stack : erro,
      );
    } finally {
      this.emExecucao = false;
    }
  }

  /** Executa uma rodada agora e devolve quantas iniciativas processou (usado nos testes). */
  executarAgora(): Promise<number> {
    return this.iniciativas.aplicarPrazosVencidos();
  }
}
