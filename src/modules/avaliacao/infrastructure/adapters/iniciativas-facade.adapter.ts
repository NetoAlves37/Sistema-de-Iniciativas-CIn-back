import type { IniciativasFacade } from '@/modules/iniciativas/application/iniciativas.facade';
import type {
  AtorAvaliacao,
  DecisaoRegistrada,
  IniciativasPort,
} from '../../application/ports/iniciativas.port';

export class IniciativasFacadeAdapter implements IniciativasPort {
  constructor(private readonly facade: IniciativasFacade) {}

  listarEmAnalise(page: number, limit: number) {
    return this.facade.listar({ status: 'EM_ANALISE', ordenar: 'relevancia', page, limit });
  }

  registrarDecisao(decisao: DecisaoRegistrada) {
    return this.facade.registrarDecisao({
      iniciativaId: decisao.iniciativaId,
      resultado: decisao.resultado,
      justificativa: decisao.justificativa,
      decisorId: decisao.decisorId,
    });
  }

  detalhe(iniciativaId: string, ator: AtorAvaliacao) {
    return this.facade.detalhe(iniciativaId, ator);
  }
}
