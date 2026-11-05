import type { UsuarioRepository } from '../../domain/ports/usuario.repository';
import { Usuario } from '../../domain/usuario';
import type { RegistrarUsuarioInput } from '../dto/usuario.dto';

/** Cria ou atualiza a projeção local do usuário a partir do que veio no token. */
export class RegistrarUsuario {
  constructor(private readonly usuarios: UsuarioRepository) {}

  async executar(input: RegistrarUsuarioInput): Promise<void> {
    const usuario = Usuario.criar(input);
    await this.usuarios.salvar(usuario);
  }
}
