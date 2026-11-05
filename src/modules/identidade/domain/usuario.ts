import { UsuarioInvalidoError } from './errors/identidade.errors';
import { ehPerfil, type Perfil } from './perfil';

/**
 * Projeção local do usuário do Keycloak: só o necessário para exibir nomes e
 * perfis (RNF-01). Nunca guarda e-mail nem contato.
 */
export class Usuario {
  private constructor(
    readonly id: string,
    readonly nome: string,
    readonly perfil: Perfil,
  ) {}

  static criar(props: { id: string; nome: string; perfil: string }): Usuario {
    const id = props.id?.trim();
    if (!id) {
      throw new UsuarioInvalidoError('identificador ausente.');
    }
    const nome = props.nome?.trim();
    if (!nome) {
      throw new UsuarioInvalidoError('nome ausente.');
    }
    if (!ehPerfil(props.perfil)) {
      throw new UsuarioInvalidoError(`perfil "${props.perfil}" desconhecido.`);
    }
    return new Usuario(id, nome, props.perfil);
  }

  equals(outro: Usuario): boolean {
    return this.id === outro.id && this.nome === outro.nome && this.perfil === outro.perfil;
  }
}
