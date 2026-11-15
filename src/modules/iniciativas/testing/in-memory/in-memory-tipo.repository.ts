import { TipoEmUsoError } from '../../domain/errors/iniciativas.errors';
import type { AutorRegistro, TipoRepository } from '../../domain/ports/tipo.repository';
import {
  type RegistroTipo,
  TipoDeIniciativa,
  type TipoDeIniciativaProps,
} from '../../domain/tipo-de-iniciativa';

/** Uma linha do log gravada pelo repositório em memória. */
export interface LinhaLogTipo extends RegistroTipo {
  tipoId: number;
  tipoCode: string;
  tipoLabel: string;
  por: string;
  porNome: string;
  ocorreuEm: Date;
}

/** `TipoRepository` em memória, para os testes dos casos de uso (sem banco). */
export class TipoRepositoryEmMemoria implements TipoRepository {
  private tipos = new Map<number, TipoDeIniciativaProps>();
  private proximoId = 1;
  readonly log: LinhaLogTipo[] = [];
  /** Quantas iniciativas usam cada tipo (os testes definem). */
  readonly usos = new Map<number, number>();

  /** Os três tipos que existiam antes do cadastro, para os testes de iniciativas. */
  semearPadrao(): void {
    this.semear({ code: 'EXTENSAO', nome: 'Extensão', cor: '#9BE0A0', ativo: true });
    this.semear({ code: 'PESQUISA', nome: 'Pesquisa', cor: '#A7C7F2', ativo: true });
    this.semear({ code: 'EVENTO', nome: 'Evento', cor: '#F7AE85', ativo: true });
  }

  semear(props: Omit<TipoDeIniciativaProps, 'id'>): number {
    const id = this.proximoId++;
    this.tipos.set(id, { ...props, id });
    return id;
  }

  persistido(id: number): TipoDeIniciativaProps | undefined {
    return this.tipos.get(id);
  }

  async buscarPorId(id: number): Promise<TipoDeIniciativa | null> {
    const props = this.tipos.get(id);
    return props ? TipoDeIniciativa.reconstituir(props) : null;
  }

  async listar(): Promise<TipoDeIniciativa[]> {
    return [...this.tipos.values()]
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.id - b.id)
      .map((props) => TipoDeIniciativa.reconstituir(props));
  }

  async codigosAtivos(): Promise<string[]> {
    return [...this.tipos.values()].filter((t) => t.ativo).map((t) => t.code);
  }

  async contarIniciativas(): Promise<Map<number, number>> {
    return new Map([...this.usos].filter(([, n]) => n > 0));
  }

  async criar(tipo: TipoDeIniciativa, autor: AutorRegistro, agora: Date): Promise<number> {
    const id = this.semear({ code: tipo.code, nome: tipo.nome, cor: tipo.cor, ativo: tipo.ativo });
    this.registrar(id, tipo, tipo.pullRegistros(), autor, agora);
    return id;
  }

  async salvar(tipo: TipoDeIniciativa, autor: AutorRegistro, agora: Date): Promise<void> {
    const registros = tipo.pullRegistros();
    if (registros.length === 0) return;
    this.tipos.set(tipo.id, {
      id: tipo.id,
      code: tipo.code,
      nome: tipo.nome,
      cor: tipo.cor,
      ativo: tipo.ativo,
    });
    this.registrar(tipo.id, tipo, registros, autor, agora);
  }

  async excluir(
    tipo: TipoDeIniciativa,
    registro: RegistroTipo,
    autor: AutorRegistro,
    agora: Date,
  ): Promise<void> {
    if ((this.usos.get(tipo.id) ?? 0) > 0) throw new TipoEmUsoError();
    this.registrar(tipo.id, tipo, [registro], autor, agora);
    this.tipos.delete(tipo.id);
  }

  private registrar(
    tipoId: number,
    tipo: TipoDeIniciativa,
    registros: RegistroTipo[],
    autor: AutorRegistro,
    agora: Date,
  ): void {
    for (const registro of registros) {
      this.log.push({
        ...registro,
        tipoId,
        tipoCode: tipo.code,
        tipoLabel: tipo.nome,
        por: autor.id,
        porNome: autor.nome,
        ocorreuEm: agora,
      });
    }
  }
}
