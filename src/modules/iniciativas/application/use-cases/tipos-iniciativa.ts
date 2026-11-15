import type { Clock } from '@/shared/domain/clock';
import { ValidacaoError } from '@/shared/domain/domain-error';
import type { TransacaoPort } from '@/shared/domain/transacao.port';
import {
  SomenteComiteError,
  TipoEmUsoError,
  TipoNaoEncontradoError,
} from '../../domain/errors/iniciativas.errors';
import type { TipoRepository } from '../../domain/ports/tipo.repository';
import { normalizarNome, TipoDeIniciativa } from '../../domain/tipo-de-iniciativa';
import type {
  AlterarTipoInput,
  AtorTipoDto,
  CadastrarTipoInput,
  TipoIniciativaDto,
} from '../dto/tipo.dto';

const ACAO_CADASTRO = 'manter o cadastro de tipos de iniciativa';

function exigirComite(ator: AtorTipoDto): void {
  if (!ator.ehComite) throw new SomenteComiteError(ACAO_CADASTRO);
}

function paraDto(tipo: TipoDeIniciativa, contagem: Map<number, number>): TipoIniciativaDto {
  return {
    id: tipo.id,
    code: tipo.code,
    nome: tipo.nome,
    cor: tipo.cor,
    ativo: tipo.ativo,
    iniciativas: contagem.get(tipo.id) ?? 0,
  };
}

/** Não podem existir dois tipos com o mesmo nome (sem diferenciar acento e maiúsculas). */
function exigirNomeLivre(nome: string, outros: TipoDeIniciativa[]): void {
  const alvo = normalizarNome(nome);
  if (outros.some((outro) => normalizarNome(outro.nome) === alvo)) {
    throw new ValidacaoError({ nome: 'Já existe um tipo com este nome.' });
  }
}

/** Todos os tipos (ativos e inativos), com a contagem de iniciativas de cada um. */
export class ListarTipos {
  constructor(private readonly tipos: TipoRepository) {}

  async executar(filtro: { somenteAtivos?: boolean } = {}): Promise<TipoIniciativaDto[]> {
    const [todos, contagem] = await Promise.all([
      this.tipos.listar(),
      this.tipos.contarIniciativas(),
    ]);
    const lista = filtro.somenteAtivos ? todos.filter((tipo) => tipo.ativo) : todos;
    return lista.map((tipo) => paraDto(tipo, contagem));
  }
}

/** Comitê ou ADMIN cadastra um tipo (nasce ativo). Registra `CRIADO` no log. */
export class CadastrarTipo {
  constructor(
    private readonly tipos: TipoRepository,
    private readonly transacao: TransacaoPort,
    private readonly clock: Clock,
  ) {}

  async executar(ator: AtorTipoDto, entrada: CadastrarTipoInput): Promise<TipoIniciativaDto> {
    exigirComite(ator);
    const existentes = await this.tipos.listar();
    const tipo = TipoDeIniciativa.criar(entrada, new Set(existentes.map((t) => t.code)));
    exigirNomeLivre(tipo.nome, existentes);
    const id = await this.transacao.run(() =>
      this.tipos.criar(tipo, { id: ator.id, nome: ator.nome }, this.clock.now()),
    );
    return {
      id,
      code: tipo.code,
      nome: tipo.nome,
      cor: tipo.cor,
      ativo: tipo.ativo,
      iniciativas: 0,
    };
  }
}

/**
 * Comitê ou ADMIN renomeia, troca a cor e/ou ativa e desativa um tipo, mesmo com iniciativas
 * associadas (o código não muda). Registra no log cada mudança efetiva.
 */
export class AlterarTipo {
  constructor(
    private readonly tipos: TipoRepository,
    private readonly transacao: TransacaoPort,
    private readonly clock: Clock,
  ) {}

  async executar(
    id: number,
    ator: AtorTipoDto,
    entrada: AlterarTipoInput,
  ): Promise<TipoIniciativaDto> {
    exigirComite(ator);
    const tipo = await this.tipos.buscarPorId(id);
    if (!tipo) throw new TipoNaoEncontradoError();

    tipo.alterar({ nome: entrada.nome, cor: entrada.cor });
    if (entrada.nome !== undefined) {
      const outros = (await this.tipos.listar()).filter((outro) => outro.id !== tipo.id);
      exigirNomeLivre(tipo.nome, outros);
    }
    if (entrada.ativo !== undefined) tipo.definirAtivo(entrada.ativo);

    await this.transacao.run(() =>
      this.tipos.salvar(tipo, { id: ator.id, nome: ator.nome }, this.clock.now()),
    );
    const contagem = await this.tipos.contarIniciativas();
    return paraDto(tipo, contagem);
  }
}

/**
 * Comitê ou ADMIN exclui um tipo. Proibido (409) se houver iniciativas associadas, em
 * qualquer status: nesse caso, a saída é desativar. Registra `EXCLUIDO` no log.
 */
export class ExcluirTipo {
  constructor(
    private readonly tipos: TipoRepository,
    private readonly transacao: TransacaoPort,
    private readonly clock: Clock,
  ) {}

  async executar(id: number, ator: AtorTipoDto): Promise<void> {
    exigirComite(ator);
    const tipo = await this.tipos.buscarPorId(id);
    if (!tipo) throw new TipoNaoEncontradoError();
    const emUso = (await this.tipos.contarIniciativas()).get(tipo.id) ?? 0;
    if (emUso > 0) throw new TipoEmUsoError(emUso);
    await this.transacao.run(() =>
      this.tipos.excluir(
        tipo,
        tipo.registroDeExclusao(),
        { id: ator.id, nome: ator.nome },
        this.clock.now(),
      ),
    );
  }
}
