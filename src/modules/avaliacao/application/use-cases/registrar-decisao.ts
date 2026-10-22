import { validarDecisao } from '../../domain/decisao';
import type { DetalheIniciativa } from '../dto/avaliacao.dto';
import type { IniciativasPort } from '../ports/iniciativas.port';

export interface RegistrarDecisaoInput {
  iniciativaId: string;
  resultado: string;
  justificativa?: string | null;
  decisor: { id: string; nome: string };
}

/**
 * RN-10: valida a justificativa e delega a decisão a `iniciativas`, que aplica as regras do
 * agregado (autor, status, concorrência). Os erros dele sobem intactos. O decisor age como
 * comitê (membros do comitê e administradores).
 */
export class RegistrarDecisao {
  constructor(private readonly iniciativas: IniciativasPort) {}

  async executar(input: RegistrarDecisaoInput): Promise<DetalheIniciativa> {
    const decisao = validarDecisao(input.resultado, input.justificativa);
    await this.iniciativas.registrarDecisao({
      iniciativaId: input.iniciativaId,
      resultado: decisao.resultado,
      justificativa: decisao.justificativa,
      decisorId: input.decisor.id,
    });
    return this.iniciativas.detalhe(input.iniciativaId, {
      id: input.decisor.id,
      nome: input.decisor.nome,
      ehComite: true,
    });
  }
}
