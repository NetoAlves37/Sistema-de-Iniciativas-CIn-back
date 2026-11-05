import type { IniciativasFacade } from '@/modules/iniciativas/application/iniciativas.facade';
import type {
  FiltroAprovadas,
  FiltroCalendario,
  IniciativasPort,
} from '../../application/ports/iniciativas.port';

export class IniciativasFacadeAdapter implements IniciativasPort {
  constructor(private readonly facade: IniciativasFacade) {}

  listarAprovadas(filtro: FiltroAprovadas) {
    return this.facade.listar({
      status: 'APROVADA',
      ordenar: 'inicio',
      q: filtro.q,
      tipo: filtro.tipo,
      page: filtro.page,
      limit: filtro.limit,
    });
  }

  aprovadasParaCalendario(filtro: FiltroCalendario) {
    return this.facade.aprovadasParaCalendario({
      de: filtro.de,
      ate: filtro.ate,
      tipos: filtro.tipos,
      autorId: filtro.autorId,
    });
  }
}
